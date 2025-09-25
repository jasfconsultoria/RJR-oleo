import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Edit, Trash2, Search, Loader2, ChevronUp, ChevronDown, Users, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { formatCnpjCpf } from '@/lib/utils';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select

const ListaClientes = ({ personType = 'pessoa' }) => {
  const [clientes, setClientes] = useState([]);
  const [allContratos, setAllContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });
  const { profile, loading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { toast } = useToast();
  const [contractStatusFilter, setContractStatusFilter] = useState('all'); // 'all', 'with_contract', 'no_contract'

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  const getLabels = (type) => {
    switch (type) {
      case 'cliente':
        return { 
          listTitle: 'Clientes', 
          pageVerb: 'Novo Cliente', 
          singularNoun: 'cliente', 
          singularArticle: 'o' 
        };
      case 'fornecedor':
        return { 
          listTitle: 'Fornecedores', 
          pageVerb: 'Novo Fornecedor', 
          singularNoun: 'fornecedor', 
          singularArticle: 'o' 
        };
      default: // 'pessoa'
        return { 
          listTitle: 'Pessoas', 
          pageVerb: 'Nova Pessoa', 
          singularNoun: 'pessoa', 
          singularArticle: 'a' 
        };
    }
  };

  const { listTitle, pageVerb, singularNoun, singularArticle } = getLabels(personType);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ title: "Erro ao buscar configurações da empresa.", variant: "destructive" });
      }
      setEmpresa(data || { items_per_page: 25 });
    };
    fetchEmpresaData();
  }, [toast]);

  useEffect(() => {
    const fetchAllContratos = async () => {
        const { data, error } = await supabase.from('contratos').select('id, cliente_id, numero_contrato, status');
        if (error) {
            toast({ title: 'Erro ao buscar contratos', variant: 'destructive' });
        } else {
            setAllContratos(data || []);
        }
    };
    // Fetch contracts only if not a 'fornecedor' list
    if (personType !== 'fornecedor') {
      fetchAllContratos();
    }
  }, [toast, personType]);

  const fetchClientes = useCallback(async () => {
    if (profileLoading || !profile || !empresa) return;
    setLoading(true);
    
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('clientes')
      .select('id, nome, nome_fantasia, cnpj_cpf, municipio, estado', { count: 'exact' });

    // Fetch client IDs with contracts if filtering by contract status
    let clientIdsWithContracts = [];
    if (personType === 'cliente' && contractStatusFilter !== 'all') {
        const { data: clientsWithContracts, error: contractsError } = await supabase
            .from('contratos')
            .select('cliente_id')
            .distinct();

        if (contractsError) {
            console.error("Error fetching clients with contracts for filter:", contractsError);
            toast({ title: 'Erro ao buscar clientes com contratos para filtro', description: contractsError.message, variant: 'destructive' });
            setClientes([]);
            setTotalCount(0);
            setLoading(false);
            return;
        }
        clientIdsWithContracts = clientsWithContracts.map(c => c.cliente_id);
    }

    if (contractStatusFilter === 'with_contract') {
        if (clientIdsWithContracts.length === 0) {
            setClientes([]);
            setTotalCount(0);
            setLoading(false);
            return;
        }
        query = query.in('id', clientIdsWithContracts);
    } else if (contractStatusFilter === 'no_contract') {
        if (clientIdsWithContracts.length > 0) {
            query = query.not('id', 'in', clientIdsWithContracts);
        }
        // If clientIdsWithContracts is empty, it means no contracts exist, so all clients are 'no_contract'
        // No additional filter needed in this case, as the main query will fetch all.
    }


    if (debouncedSearchTerm) {
      query = query.or(`nome.ilike.%${debouncedSearchTerm}%,nome_fantasia.ilike.%${debouncedSearchTerm}%,cnpj_cpf.ilike.%${debouncedSearchTerm}%,municipio.ilike.%${debouncedSearchTerm}%,estado.ilike.%${debouncedSearchTerm}%`);
    }

    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    let { data: clientesData, error: clientesError, count } = await query;

    if (clientesError) {
      toast({
        title: 'Erro ao carregar clientes',
        description: clientesError.message,
        variant: 'destructive',
      });
      setClientes([]);
    } else {
      setClientes(clientesData || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [profile, profileLoading, toast, currentPage, pageSize, debouncedSearchTerm, sortConfig, empresa, personType, contractStatusFilter]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize, contractStatusFilter]);

  const handleDelete = async (cliente) => {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', cliente.id);
    
    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: "Não foi possível excluir o cliente. Verifique se ele possui coletas, contratos ou certificados vinculados.",
        variant: 'destructive',
      });
      await logAction('delete_client_failed', { error: error.message, client_id: cliente.id, client_name: cliente.nome });
    } else {
      toast({
        title: 'Cliente excluído!',
        description: 'O cliente foi removido com sucesso.',
      });
      await logAction('delete_client_success', { client_id: cliente.id, client_name: cliente.nome });
      fetchClientes();
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const getContractStatus = (clienteId) => {
    if (allContratos.length === 0) {
      return <span className="text-gray-400">Carregando...</span>;
    }
    const contratosDoCliente = allContratos.filter(c => c.cliente_id === clienteId);
    if (contratosDoCliente.length === 0) {
      return <span className="text-gray-400">Sem Contrato</span>;
    }
    const activeContract = contratosDoCliente.find(c => c.status === 'Ativo');
    if (activeContract) {
      return <span className="text-emerald-400 font-semibold">{activeContract.numero_contrato}</span>;
    }
    return <span className="text-yellow-500">Contrato Inativo/Vencido</span>;
  };

  if (profileLoading || !empresa) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet>
        <title>Lista de {listTitle} - Sistema RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Users className="w-8 h-8 text-emerald-400" /> Lista de {listTitle}
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize e gerencie {listTitle.toLowerCase()} cadastradas.</p>
          </div>
          <Link to={personType === 'cliente' ? '/app/cadastro/clientes/novo' : '/app/cadastro/fornecedores/novo'} className='w-full sm:w-auto'>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" />
              {pageVerb}
            </Button>
          </Link>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                    <Input
                    type="search"
                    placeholder={`Buscar por nome, CNPJ/CPF, município ou estado d${singularArticle} ${singularNoun}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                    />
                </div>
                {personType === 'cliente' && (
                    <div>
                        <Label htmlFor="contractStatusFilter" className="block text-white mb-1 text-sm">Status do Contrato</Label>
                        <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="with_contract">Com Contrato</SelectItem>
                                <SelectItem value="no_contract">Sem Contrato</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
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
                    <TableRow className="hover:bg-white/10 border-b border-white/20 text-xs">
                      <th onClick={() => requestSort('nome')} className="cursor-pointer text-white p-2 text-left">
                        <div className="flex items-center">Razão Social / Nome Fantasia {getSortIcon('nome')}</div>
                      </th>
                      <th onClick={() => requestSort('cnpj_cpf')} className="cursor-pointer text-white p-2 text-left">
                        <div className="flex items-center">CNPJ/CPF {getSortIcon('cnpj_cpf')}</div>
                      </th>
                      <th onClick={() => requestSort('municipio')} className="cursor-pointer text-white p-2 text-left">
                        <div className="flex items-center">Localização {getSortIcon('municipio')}</div>
                      </th>
                      {personType !== 'fornecedor' && ( 
                        <th className="text-left text-white p-2">Contrato</th>
                      )}
                      <th className="text-left text-white p-2">Ações</th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientes.length > 0 ? clientes.map((cliente) => (
                      <TableRow key={cliente.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Razão Social / Nome Fantasia" className="font-medium p-2">
                          {cliente.nome_fantasia ? `${cliente.nome} - ${cliente.nome_fantasia}` : cliente.nome}
                        </TableCell>
                        <TableCell data-label="CNPJ/CPF" className="p-2">{formatCnpjCpf(cliente.cnpj_cpf)}</TableCell>
                        <TableCell data-label="Localização" className="p-2">{cliente.municipio}, {cliente.estado}</TableCell>
                        {personType !== 'fornecedor' && ( 
                          <TableCell data-label="Contrato" className="p-2">{getContractStatus(cliente.id)}</TableCell>
                        )}
                        <TableCell className="p-2 actions-cell">
                          <div className="flex items-center gap-1">
                            {personType !== 'fornecedor' && ( 
                              <Button variant="ghost" size="icon" title="Ver Contratos" onClick={() => navigate(`/app/cadastro/contratos?clienteId=${cliente.id}`)}>
                                  <FileText className="h-4 w-4 text-cyan-400" />
                              </Button>
                            )}
                            <Link to={`/app/cadastro/${personType}s/editar/${cliente.id}`}>
                              <Button variant="ghost" size="icon" title={`Editar ${singularNoun}`}>
                                <Edit className="h-4 w-4 text-yellow-400" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title={`Excluir ${singularNoun}`}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-emerald-300">
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente {singularArticle} {singularNoun}. Certifique-se de que não há coletas, contratos ou certificados vinculados.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel asChild>
                                    <Button variant="outline" className="rounded-xl">Cancelar</Button>
                                  </AlertDialogCancel>
                                  <AlertDialogAction asChild>
                                    <Button onClick={() => handleDelete(cliente)} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Excluir</Button>
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={personType !== 'fornecedor' ? 5 : 4} className="h-24 text-center text-white/70"> 
                          Nenhum{singularArticle === 'a' ? 'a' : ''} {singularNoun} encontrado{singularArticle === 'a' ? 'a' : ''}.
                        </TableCell>
                      </TableRow>
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
    </>
  );
};

export default ListaClientes;