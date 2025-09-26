import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, FileText, Search, Share2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { formatDateWithTimezone, escapePostgrestLikePattern } from '@/lib/utils';
import ContratoViewModal from '@/components/contratos/ContratoViewModal';
import { motion } from 'framer-motion';
// Removido: import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';

const ListaContratos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();

  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contratoSearchTerm, setContratoSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState(''); // Novo estado para busca de cliente
  const [filterById, setFilterById] = useState(null); // NEW: State to store client ID from URL
  const debouncedContratoSearchTerm = useDebounce(contratoSearchTerm, 500);
  const debouncedClientSearchTerm = useDebounce(clientSearchTerm, 500); // Debounce para busca de cliente
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const [selectedContrato, setSelectedContrato] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  // Removido: [clientesMap, setClientesMap] = useState({});

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);
  const empresaTimezone = useMemo(() => empresa?.timezone || 'America/Sao_Paulo', [empresa]);

  // Initialize clientSearchTerm from URL query param
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const clienteIdFromUrl = queryParams.get('clienteId');
    if (clienteIdFromUrl) {
      setFilterById(clienteIdFromUrl); // Set the ID for direct filtering
      // Fetch client name to pre-fill the search input
      const fetchClientName = async () => {
        const { data, error } = await supabase.from('clientes').select('nome, nome_fantasia').eq('id', clienteIdFromUrl).single();
        if (data) {
          setClientSearchTerm(data.nome_fantasia ? `${data.nome} - ${data.nome_fantasia}` : data.nome);
        }
      };
      fetchClientName();
    } else {
      setFilterById(null); // Clear filterById if no ID in URL
    }
  }, [location.search]);


  // Removido: useEffect para fetchClientes, pois agora a busca é direta na query principal
  // useEffect(() => {
  //   const fetchClientes = async () => {
  //       const { data, error } = await supabase.from('clientes').select('id, nome, nome_fantasia');
  //       if (error) {
  //           toast({ title: 'Erro ao buscar clientes', variant: 'destructive' });
  //       } else {
  //           const map = (data || []).reduce((acc, cliente) => {
  //               acc[cliente.id] = cliente.nome_fantasia ? `${cliente.nome} - ${cliente.nome_fantasia}` : cliente.nome;
  //               return acc;
  //           }, {});
  //           setClientesMap(map);
  //       }
  //   };
  //   fetchAllClientes();
  // }, [toast]);

  const fetchContratos = useCallback(async () => {
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('contratos')
      .select('*, pdf_url, cliente:clientes(id, nome, nome_fantasia)', { count: 'exact' }) // Incluir id do cliente
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filterById) { // Prioritize filtering by ID if present
        query = query.eq('cliente_id', filterById);
    } else if (debouncedClientSearchTerm) {
        // If no direct ID filter, use text search
        const escapedClientSearchTerm = escapePostgrestLikePattern(debouncedClientSearchTerm);
        const { data: matchingClients, error: clientError } = await supabase
            .from('clientes')
            .select('id')
            .or(`nome.ilike.%${escapedClientSearchTerm}%,nome_fantasia.ilike.%${escapedClientSearchTerm}%`);
        if (clientError) {
            console.error("Error fetching matching clients for contracts:", clientError);
            toast({ title: 'Erro ao buscar clientes para filtro', description: clientError.message, variant: 'destructive' });
            setContratos([]);
            setTotalCount(0);
            setLoading(false);
            return;
        } else {
            const clientIds = matchingClients.map(c => c.id);
            if (clientIds.length === 0) {
                setContratos([]);
                setTotalCount(0);
                setLoading(false);
                return;
            }
            query = query.in('cliente_id', clientIds);
        }
    }

    if (debouncedContratoSearchTerm) {
      const escapedContratoSearchTerm = escapePostgrestLikePattern(debouncedContratoSearchTerm);
      query = query.ilike('numero_contrato', `%${escapedContratoSearchTerm}%`);
    }
    
    const { data, error, count } = await query;

    if (error) {
      console.error("Erro Supabase:", JSON.stringify(error, null, 2));
      toast({ title: 'Erro ao buscar contratos', description: `Falha na consulta: ${error.message}`, variant: 'destructive' });
      setContratos([]);
    } else {
      setContratos(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [toast, currentPage, pageSize, debouncedContratoSearchTerm, debouncedClientSearchTerm, filterById, empresa]); // Add filterById to dependencies

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page, timezone').single();
      if (error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
      else setEmpresa(data || { items_per_page: 25, timezone: 'America/Sao_Paulo' });
    };
    fetchEmpresa();
  }, [toast]);

  useEffect(() => {
    if (empresa) {
      fetchContratos();
    }
  }, [fetchContratos, empresa]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedContratoSearchTerm, debouncedClientSearchTerm, filterById, pageSize]); // Add filterById to dependencies

  const handleDelete = async (id, numeroContrato) => {
    const { error } = await supabase.from('contratos').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao deletar contrato', description: error.message, variant: 'destructive' });
    } else {
      await logAction('delete_contract', { details: { contrato_id: id, numero_contrato: numeroContrato } });
      toast({ title: 'Contrato deletado com sucesso' });
      fetchContratos();
    }
  };

  const handleViewContrato = async (contrato) => {
    setLoading(true);
    // Fetch full client data for the modal if not already available
    const { data, error } = await supabase.from('contratos').select('*, pessoa:clientes(*)').eq('id', contrato.id).single();
    if (error) {
      toast({ title: 'Erro ao buscar detalhes do contrato', description: error.message, variant: 'destructive' });
    } else {
      setSelectedContrato(data);
      setIsViewModalOpen(true);
    }
    setLoading(false);
  };

  const handleOpenPdf = (contrato) => {
    if (contrato.status === 'Aguardando Assinatura') {
        navigate(`/assinatura/${contrato.id}`);
    } else if (contrato.status === 'Ativo') {
        navigate(`/contrato-assinado/${contrato.id}`);
    } else {
        toast({
            title: 'Ação não disponível',
            description: `Não é possível abrir o contrato com status "${contrato.status}".`,
            variant: 'destructive'
        });
    }
  };

  const handleShare = async (contrato) => {
    if (!contrato || !contrato.id) {
        toast({ title: 'Erro', description: 'ID do contrato não encontrado.', variant: 'destructive' });
        return;
    }

    let link = '';
    let shareTitle = '';
    let shareText = '';

    if (contrato.status === 'Aguardando Assinatura') {
        link = `${window.location.origin}/assinatura/${contrato.id}`;
        shareTitle = "Link de Assinatura do Contrato";
        shareText = `Olá! Segue o link para assinatura do contrato Nº ${contrato.numero_contrato}.`;
    } else if (contrato.status === 'Ativo') {
        link = `${window.location.origin}/contrato-assinado/${contrato.id}`;
        shareTitle = "Link do Contrato Assinado";
        shareText = `Olá! Segue o link para visualização do contrato assinado Nº ${contrato.numero_contrato}.`;
    } else {
        toast({ title: 'Ação não disponível', description: `Não é possível compartilhar um contrato com status "${contrato.status}".`, variant: 'destructive' });
        return;
    }

    if (navigator.share) {
        try {
            await navigator.share({ title: shareTitle, text: shareText, url: link });
            toast({ title: 'Sucesso!', description: 'Contrato compartilhado.' });
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
        }
    } else {
        navigator.clipboard.writeText(link);
        toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
    }
  };

  // Handler for client search input change
  const handleClientSearchInputChange = (e) => {
    setClientSearchTerm(e.target.value);
    // When user starts typing, clear the direct ID filter
    if (filterById) {
      setFilterById(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Ativo':
        return 'bg-green-500/20 text-green-300';
      case 'Inativo':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'Cancelado':
        return 'bg-red-500/20 text-red-300';
      case 'Aguardando Assinatura':
        return 'bg-blue-500/20 text-blue-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <>
      <Helmet><title>Lista de Contratos - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <FileText className="w-8 h-8 text-emerald-400" /> Lista de Contratos
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie os contratos de prestação de serviços.</p>
          </div>
          <Button onClick={() => navigate('/app/cadastro/contratos/novo')} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Contrato
          </Button>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contratoSearch" className="block text-white mb-1 text-sm">Nº Contrato</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="contratoSearch"
                  type="search"
                  placeholder="Buscar por número do contrato..."
                  value={contratoSearchTerm}
                  onChange={(e) => setContratoSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="clientSearch"
                  type="search"
                  placeholder="Buscar por nome do cliente..."
                  value={clientSearchTerm}
                  onChange={handleClientSearchInputChange} // Use the new handler
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <th className="p-2 text-left text-white">Nº Contrato</th>
                    <th className="p-2 text-left text-white">Cliente</th>
                    <th className="p-2 text-left text-white">Início</th>
                    <th className="p-2 text-left text-white">Fim</th>
                    <th className="p-2 text-center text-white">Status</th>
                    <th className="p-2 text-right text-white">Ações</th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contratos.length > 0 ? (
                    contratos.map(contrato => (
                      <TableRow key={contrato.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Nº Contrato">
                          <Button variant="link" onClick={() => handleViewContrato(contrato)} className="p-0 h-auto text-white/90 hover:text-emerald-300">
                            {contrato.numero_contrato}
                          </Button>
                        </TableCell>
                        <TableCell data-label="Cliente">{contrato.cliente?.nome_fantasia ? `${contrato.cliente.nome} - ${contrato.cliente.nome_fantasia}` : contrato.cliente?.nome || 'N/A'}</TableCell>
                        <TableCell data-label="Início">{formatDateWithTimezone(contrato.data_inicio, empresaTimezone)}</TableCell>
                        <TableCell data-label="Fim">{formatDateWithTimezone(contrato.data_fim, empresaTimezone)}</TableCell>
                        <TableCell data-label="Status" className="text-center">
                          <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getStatusBadge(contrato.status)}`}>
                            {contrato.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right actions-cell">
                           <div className="flex justify-end items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenPdf(contrato)} title="Abrir Contrato"><FileText className="h-4 w-4 text-blue-400" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleShare(contrato)} title="Compartilhar"><Share2 className="h-4 w-4 text-green-400" /></Button>
                            <Button variant="ghost" size="icon" className="text-yellow-400 hover:text-yellow-300 rounded-xl" onClick={() => navigate(`/app/cadastro/contratos/editar/${contrato.id}`)} title="Editar"><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 rounded-xl" title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-emerald-300">Essa ação não pode ser desfeita. Isso deletará permanentemente o contrato {contrato.numero_contrato}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(contrato.id, contrato.numero_contrato)} className="bg-red-500 hover:bg-red-600 rounded-xl">Deletar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                           </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan="6" className="text-center text-gray-400 py-10">Nenhum contrato encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            </div>
        </motion.div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </div>

      {isViewModalOpen && selectedContrato && (
         <ContratoViewModal 
            contrato={selectedContrato} 
            isOpen={isViewModalOpen} 
            onClose={() => setIsViewModalOpen(false)}
         />
      )}
    </>
  );
};

export default ListaContratos;