import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Loader2, FileText, Edit, Trash2, Share2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { ReciboAvulsoViewDialog } from '@/components/recibos-avulsos/ReciboAvulsoViewDialog';
import { formatCurrency, formatCnpjCpf } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ListaRecibosAvulsos = () => {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'data_recibo', direction: 'desc' });
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [returnPath, setReturnPath] = useState(null);
  const [empresa, setEmpresa] = useState({
    items_per_page: 25,
    timezone: 'America/Sao_Paulo',
    nome_fantasia: 'Nome da Empresa',
    razao_social: 'Razão Social da Empresa',
    cnpj: 'N/A',
    telefone: '',
    email: '',
    endereco: '',
    logo_documento_url: null
  });

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reciboToDelete, setReciboToDelete] = useState(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedStartDate = useDebounce(startDate, 500);
  const debouncedEndDate = useDebounce(endDate, 500);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      try {
        const { data, error } = await supabase.from('empresa').select('*').single();
        if (error) {
          console.warn("Usando configuração padrão para empresa");
        }
        setEmpresa(data || {
          items_per_page: 25,
          timezone: 'America/Sao_Paulo',
          nome_fantasia: 'Nome da Empresa',
          razao_social: 'Razão Social da Empresa',
          cnpj: 'N/A',
          telefone: '',
          email: '',
          endereco: '',
          municipio: '',
          estado: '',
          logo_documento_url: null
        });
      } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        setEmpresa({
          items_per_page: 25,
          timezone: 'America/Sao_Paulo',
          nome_fantasia: 'Nome da Empresa',
          razao_social: 'Razão Social da Empresa',
          cnpj: 'N/A',
          telefone: '',
          email: '',
          endereco: '',
          logo_documento_url: null
        });
      }
    };
    fetchEmpresaData();
  }, []);

  const refreshRecibosData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('recibos_avulso')
        .select('*', { count: 'exact' });

      // Filtros
      if (debouncedSearchTerm) {
        query = query.or(`pessoa_nome.ilike.%${debouncedSearchTerm}%,numero_recibo.ilike.%${debouncedSearchTerm}%,descricao.ilike.%${debouncedSearchTerm}%`);
      }

      if (tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter);
      }

      if (debouncedStartDate) {
        query = query.gte('data_recibo', debouncedStartDate);
      }

      if (debouncedEndDate) {
        query = query.lte('data_recibo', debouncedEndDate);
      }

      // Ordenação
      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });

      // Paginação
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setRecibos(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Erro ao buscar recibos:', error);
      toast({
        title: 'Erro ao carregar recibos',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, tipoFilter, debouncedStartDate, debouncedEndDate, sortConfig, currentPage, pageSize, toast]);

  useEffect(() => {
    refreshRecibosData();
  }, [refreshRecibosData]);

  // Efeito para abrir o recibo vindo do FinanceiroForm
  useEffect(() => {
    if (!loading && location.state?.openReciboId && recibos.length > 0) {
      const reciboToOpen = recibos.find(r => r.id === location.state.openReciboId);
      if (reciboToOpen) {
        setSelectedRecibo(reciboToOpen);
        setReciboModalOpen(true);
        // Se houver um caminho de retorno, salvamos antes de limpar o state
        if (location.state.returnPath) {
          setReturnPath(location.state.returnPath);
        }
        // Limpar o estado para não reabrir ao navegar de volta
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [loading, location.state, recibos, navigate, location.pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, tipoFilter, debouncedStartDate, debouncedEndDate]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleDelete = async () => {
    if (!reciboToDelete) return;

    const { error } = await supabase
      .from('recibos_avulso')
      .delete()
      .eq('id', reciboToDelete.id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
      await logAction('delete_recibo_avulso_failed', { error: error.message, recibo_id: reciboToDelete.id });
    } else {
      toast({
        title: 'Recibo excluído!',
        description: 'O recibo foi removido com sucesso.'
      });
      await logAction('delete_recibo_avulso_success', { recibo_id: reciboToDelete.id, numero_recibo: reciboToDelete.numero_recibo });
      refreshRecibosData();
    }

    setDeleteDialogOpen(false);
    setReciboToDelete(null);
  };

  const handleReciboAction = async (reciboId) => {
    const recibo = recibos.find(r => r.id === reciboId);
    if (recibo) {
      setSelectedRecibo(recibo);
      setReciboModalOpen(true);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (recibo) => {
    if (recibo.assinatura_url) {
      return { text: 'Assinado', className: 'bg-green-500/20 text-green-300' };
    }
    return { text: 'Pendente', className: 'bg-yellow-500/20 text-yellow-300' };
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      'cliente': 'Cliente',
      'fornecedor': 'Fornecedor',
      'coletor': 'Coletor'
    };
    return labels[tipo] || tipo;
  };

  return (
    <>
      <Helmet>
        <title>Recibos Avulsos - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Recibos Avulsos</h1>
            <p className="text-emerald-200">Gerencie recibos para clientes, fornecedores e coletores</p>
          </div>
          <Link to="/app/financeiro/recibos/novo">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Recibo
            </Button>
          </Link>
        </div>

        {/* Filtros */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
              <input
                id="searchTerm"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, número ou descrição..."
                className="w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <Label htmlFor="tipoFilter" className="block text-white mb-1 text-sm">Tipo</Label>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="coletor">Coletor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Inicial</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white/20 border-white/30 text-white rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Final</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white/20 border-white/30 text-white rounded-xl px-3 py-2"
              />
            </div>
          </div>
        </motion.div>

        {/* Tabela */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl"
        >
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('numero_recibo')}>
                      Nº Recibo {sortConfig.key === 'numero_recibo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('data_recibo')}>
                      Data {sortConfig.key === 'data_recibo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300">Tipo</TableHead>
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('pessoa_nome')}>
                      Nome {sortConfig.key === 'pessoa_nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300">Descrição</TableHead>
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('valor')}>
                      Valor {sortConfig.key === 'valor' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300">Status</TableHead>
                    <TableHead className="text-emerald-300 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recibos.length > 0 ? (
                    recibos.map((recibo) => {
                      const statusInfo = getStatusBadge(recibo);
                      return (
                        <TableRow key={recibo.id} className="border-b border-white/10 hover:bg-white/5">
                          <TableCell className="font-semibold text-white">
                            {recibo.numero_recibo?.toString().padStart(6, '0')}
                          </TableCell>
                          <TableCell className="text-white">
                            {format(parseISO(recibo.data_recibo), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-white">
                            {getTipoLabel(recibo.tipo)}
                          </TableCell>
                          <TableCell className="text-white">
                            {recibo.pessoa_nome}
                          </TableCell>
                          <TableCell className="text-white max-w-xs truncate" title={recibo.descricao}>
                            {recibo.descricao}
                          </TableCell>
                          <TableCell className="text-white font-semibold">
                            {formatCurrency(recibo.valor || 0)}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}>
                              {statusInfo.text}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReciboAction(recibo.id)}
                                title="Ver Recibo"
                                className="text-blue-400 hover:text-blue-300 rounded-xl"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/app/financeiro/recibos/editar/${recibo.id}`)}
                                title={recibo.assinatura_url ? "Recibo assinado não pode ser editado" : "Editar Recibo"}
                                disabled={!!recibo.assinatura_url}
                                className="text-yellow-400 hover:text-yellow-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog open={deleteDialogOpen && reciboToDelete?.id === recibo.id} onOpenChange={setDeleteDialogOpen}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setReciboToDelete(recibo);
                                    setDeleteDialogOpen(true);
                                  }}
                                  title="Excluir Recibo"
                                  className="text-red-400 hover:text-red-300 rounded-xl"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <AlertDialogContent className="bg-gray-800 border-gray-700 text-white">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja excluir o recibo Nº {recibo.numero_recibo?.toString().padStart(6, '0')}? Esta ação não pode ser desfeita.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="bg-gray-700 text-white hover:bg-gray-600">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-white py-8">
                        Nenhum recibo encontrado
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

        {reciboModalOpen && selectedRecibo && (
          <ReciboAvulsoViewDialog
            recibo={selectedRecibo}
            empresa={empresa}
            isOpen={reciboModalOpen}
            onClose={() => {
              setReciboModalOpen(false);
              if (returnPath) {
                navigate(returnPath);
                setReturnPath(null); // Limpar após o uso
              } else {
                setTimeout(() => {
                  refreshRecibosData();
                }, 1000);
              }
            }}
          />
        )}
      </div>
    </>
  );
};

export default ListaRecibosAvulsos;
