import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Search, ListChecks, ArrowDownSquare, ArrowUpSquare, Eye } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import ProdutoSearchableSelect from '@/components/estoque/ProdutoSearchableSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/lib/utils';
import MovimentacaoViewDialog from '@/components/estoque/MovimentacaoViewDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

const ListaMovimentacoesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: '',
    selectedClienteId: null,
    selectedProdutoId: null,
    startDate: '',
    endDate: '',
    type: 'all', // 'entrada', 'saida', 'all'
  });
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const [viewingMovimentacao, setViewingMovimentacao] = useState(null);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
      else setEmpresa(data || { items_per_page: 25 });
    };
    fetchEmpresa();
  }, [toast]);

  const fetchMovimentacoes = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('entrada_saida')
      .select(`
        id,
        data,
        tipo,
        origem,
        observacao,
        cliente:clientes(nome),
        coleta_id,
        itens_entrada_saida(
          id,
          quantidade,
          produto:produtos(nome, unidade)
        )
      `, { count: 'exact' })
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (debouncedFilters.searchTerm) {
      query = query.ilike('observacao', `%${debouncedFilters.searchTerm}%`);
    }
    if (debouncedFilters.selectedClienteId) {
      query = query.eq('cliente_id', debouncedFilters.selectedClienteId);
    }
    if (debouncedFilters.selectedProdutoId) {
      // This requires a join or a subquery, which is complex in RLS.
      // For simplicity, we'll filter on the client side for now if product filter is active.
      // A more robust solution would involve a custom RPC or a view that includes item details.
    }
    if (debouncedFilters.startDate) {
      query = query.gte('data', debouncedFilters.startDate);
    }
    if (debouncedFilters.endDate) {
      query = query.lte('data', debouncedFilters.endDate);
    }
    if (debouncedFilters.type !== 'all') {
      query = query.eq('tipo', debouncedFilters.type);
    }

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao buscar movimentações', description: error.message, variant: 'destructive' });
      setMovimentacoes([]);
    } else {
      let filteredData = data || [];
      if (debouncedFilters.selectedProdutoId) {
        filteredData = filteredData.filter(mov =>
          mov.itens_entrada_saida.some(item => item.produto.id === debouncedFilters.selectedProdutoId)
        );
      }
      setMovimentacoes(filteredData);
      setTotalCount(count || 0); // Note: count might be inaccurate if client-side filtering is applied
    }
    setLoading(false);
  }, [toast, currentPage, pageSize, debouncedFilters, empresa]);

  useEffect(() => {
    if (empresa) {
      fetchMovimentacoes();
    }
  }, [fetchMovimentacoes, empresa]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters, pageSize]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // A função handleDelete foi removida, pois o botão de exclusão não estará mais presente.
  // const handleDelete = async (id) => {
  //   const { error } = await supabase.from('entrada_saida').delete().eq('id', id);
  //   if (error) {
  //     toast({ title: 'Erro ao deletar movimentação', description: error.message, variant: 'destructive' });
  //   } else {
  //     await logAction('delete_stock_movement', { movimentacao_id: id });
  //     toast({ title: 'Movimentação deletada com sucesso' });
  //     fetchMovimentacoes();
  //   }
  // };

  const handleViewMovimentacao = (mov) => {
    setViewingMovimentacao(mov);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getMovementIcon = (type) => {
    return type === 'entrada' ? <ArrowDownSquare className="h-4 w-4 text-green-400" /> : <ArrowUpSquare className="h-4 w-4 text-red-400" />;
  };

  const getEditRoute = (mov) => {
    return mov.tipo === 'entrada' ? `/app/estoque/entradas/editar/${mov.id}` : `/app/estoque/saidas/editar/${mov.id}`;
  };

  return (
    <>
      <Helmet><title>Movimentações de Estoque - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <ListChecks className="w-8 h-8 text-emerald-400" /> Movimentações de Estoque
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize e gerencie todas as entradas e saídas do estoque.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
            <Button onClick={() => navigate('/app/estoque/entradas/novo')} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Entrada
            </Button>
            <Button onClick={() => navigate('/app/estoque/saidas/novo')} className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Saída
            </Button>
          </div>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="searchTerm"
                  type="search"
                  placeholder="Observação..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <ClienteSearchableSelect
                labelText="Cliente"
                value={filters.selectedClienteId}
                onChange={(value) => handleFilterChange('selectedClienteId', value)}
              />
            </div>
            <div>
              <ProdutoSearchableSelect
                labelText="Produto"
                value={filters.selectedProdutoId}
                onChange={(product) => handleFilterChange('selectedProdutoId', product ? product.id : null)}
              />
            </div>
            <div>
              <Label htmlFor="type" className="block text-white mb-1 text-sm">Tipo</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
              <Input id="startDate" type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} className="bg-white/20 border-white/30 text-white rounded-xl" />
            </div>
            <div>
              <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
              <Input id="endDate" type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} className="bg-white/20 border-white/30 text-white rounded-xl" />
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
                    <th className="p-2 text-left text-white">Data</th>
                    <th className="p-2 text-left text-white">Tipo</th>
                    <th className="p-2 text-left text-white">Origem</th>
                    <th className="p-2 text-left text-white">Cliente</th>
                    <th className="p-2 text-left text-white">Itens</th>
                    <th className="p-2 text-right text-white">Ações</th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.length > 0 ? (
                    movimentacoes.map(mov => {
                      const isLinkedToColeta = !!mov.coleta_id;
                      return (
                        <TableRow key={mov.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Data">{format(parseISO(mov.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                          <TableCell data-label="Tipo" className="capitalize flex items-center gap-2">
                            {getMovementIcon(mov.tipo)} {mov.tipo}
                          </TableCell>
                          <TableCell data-label="Origem" className="capitalize">{mov.origem}</TableCell>
                          <TableCell data-label="Cliente">{mov.cliente?.nome || 'N/A'}</TableCell>
                          <TableCell data-label="Itens">
                            {mov.itens_entrada_saida.map((item, idx) => (
                              <div key={idx} className="text-xs">
                                {item.produto.nome}: {formatNumber(item.quantidade)} {item.produto.unidade}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="text-right actions-cell">
                            <TooltipProvider>
                              <div className="flex justify-end items-center gap-2">
                                <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 rounded-xl" onClick={() => handleViewMovimentacao(mov)}><Eye className="h-4 w-4" /></Button>
                                {/* Botão Editar */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      title="Editar Movimentação" 
                                      className={`text-yellow-400 hover:text-yellow-300 rounded-xl ${isLinkedToColeta ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                      onClick={() => navigate(getEditRoute(mov))}
                                      disabled={isLinkedToColeta}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  {isLinkedToColeta && (
                                    <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                      <p>Movimentações de coletas devem ser editadas na coleta de origem.</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                {/* O botão Excluir foi removido daqui */}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow><TableCell colSpan="6" className="text-center text-gray-400 py-10">Nenhuma movimentação encontrada.</TableCell></TableRow>
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
      {viewingMovimentacao && (
        <MovimentacaoViewDialog
          isOpen={!!viewingMovimentacao}
          onClose={() => setViewingMovimentacao(null)}
          movimentacao={viewingMovimentacao}
        />
      )}
    </>
  );
};

export default ListaMovimentacoesPage;