import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, Search, ListChecks, ArrowDownSquare, ArrowUpSquare, Eye } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClienteSearchableSelect from '@/components/clientes/ClienteSearchableSelect';
import ProdutoSearchableSelect from '@/components/produtos/ProdutoSearchableSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatNumber } from '@/lib/utils';
import MovimentacaoViewDialog from '@/components/estoque/MovimentacaoViewDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DatePicker } from '@/components/ui/date-picker';

const ListaMovimentacoesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: '',
    clientSearchTerm: '',
    selectedProdutoId: null,
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    type: 'all',
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
        document_number,
        cliente:clientes(id, razao_social, nome_fantasia),
        coleta_id,
        itens_entrada_saida(
          id,
          quantidade,
          produto:produtos(id, nome, unidade)
        )
      `, { count: 'exact' })
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Filtros do servidor
    if (debouncedFilters.searchTerm) {
      query = query.or(`observacao.ilike.%${debouncedFilters.searchTerm}%,document_number.ilike.%${debouncedFilters.searchTerm}%`);
    }
    if (debouncedFilters.startDate) {
      query = query.gte('data', format(debouncedFilters.startDate, 'yyyy-MM-dd'));
    }
    if (debouncedFilters.endDate) {
      query = query.lte('data', format(debouncedFilters.endDate, 'yyyy-MM-dd'));
    }
    if (debouncedFilters.type !== 'all') {
      query = query.eq('tipo', debouncedFilters.type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar movimentações:', error);
      toast({ title: 'Erro ao buscar movimentações', description: error.message, variant: 'destructive' });
      setMovimentacoes([]);
      setTotalCount(0);
    } else {
      let filteredData = data || [];
      
      // Filtro por cliente no lado do cliente (client-side)
      if (debouncedFilters.clientSearchTerm) {
        const searchTermLower = debouncedFilters.clientSearchTerm.toLowerCase();
        filteredData = filteredData.filter(mov => {
          const razaoSocial = mov.cliente?.razao_social || '';
          const nomeFantasia = mov.cliente?.nome_fantasia || '';
          
          return (
            razaoSocial.toLowerCase().includes(searchTermLower) ||
            nomeFantasia.toLowerCase().includes(searchTermLower)
          );
        });
      }
      
      // Filtro por produto no lado do cliente (client-side)
      if (debouncedFilters.selectedProdutoId) {
        filteredData = filteredData.filter(mov =>
          mov.itens_entrada_saida.some(item => item.produto.id === debouncedFilters.selectedProdutoId)
        );
      }
      
      setMovimentacoes(filteredData);
      setTotalCount(filteredData.length);
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

  const handleDelete = async (id) => {
    const { error } = await supabase.from('entrada_saida').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao deletar movimentação', description: error.message, variant: 'destructive' });
    } else {
      await logAction('delete_stock_movement', { movimentacao_id: id });
      toast({ title: 'Movimentação deletada com sucesso' });
      fetchMovimentacoes();
    }
  };

  const handleViewMovimentacao = (mov) => {
    setViewingMovimentacao(mov);
  };

  // Função auxiliar para verificar se a movimentação está vinculada a coleta
  const isMovimentacaoVinculadaColeta = (movimentacao) => {
    return movimentacao.origem === 'coleta' || movimentacao.coleta_id != null;
  };

  // Função para obter o nome de exibição do cliente
  const getClientDisplayName = (cliente) => {
    if (!cliente) return 'N/A';
    
    const nomeFantasia = cliente.nome_fantasia || '';
    const razaoSocial = cliente.razao_social || '';
    
    if (nomeFantasia && razaoSocial) {
      return `${nomeFantasia} - ${razaoSocial}`;
    }
    return nomeFantasia || razaoSocial || 'Cliente sem nome';
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
          {/* Primeira linha de filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Buscar */}
            <div className="lg:col-span-1">
              <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="searchTerm"
                  type="search"
                  placeholder="Nº Doc, Observação..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            
            {/* Cliente */}
            <div className="lg:col-span-2">
              <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="clientSearch"
                  type="search"
                  placeholder="Buscar por nome fantasia ou razão social..."
                  value={filters.clientSearchTerm}
                  onChange={(e) => handleFilterChange('clientSearchTerm', e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>

            {/* Produto */}
            <div className="lg:col-span-1">
              <ProdutoSearchableSelect
                labelText="Produto"
                value={filters.selectedProdutoId}
                onChange={(product) => handleFilterChange('selectedProdutoId', product ? product.id : null)}
              />
            </div>

            {/* Tipo */}
            <div className="lg:col-span-1">
              <Label htmlFor="type" className="block text-white mb-1 text-sm">Tipo</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Segunda linha de filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Data Início */}
            <div className="lg:col-span-1">
              <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
              <DatePicker
                date={filters.startDate}
                setDate={(date) => handleFilterChange('startDate', date)}
                className="w-full bg-white/20 border-white/30 text-white rounded-xl"
              />
            </div>
            
            {/* Data Fim */}
            <div className="lg:col-span-1">
              <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
              <DatePicker
                date={filters.endDate}
                setDate={(date) => handleFilterChange('endDate', date)}
                className="w-full bg-white/20 border-white/30 text-white rounded-xl"
              />
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
                      const isVinculadaColeta = isMovimentacaoVinculadaColeta(mov);

                      return (
                        <TableRow key={mov.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Data">{format(parseISO(mov.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                          <TableCell data-label="Tipo" className="capitalize flex items-center gap-2">
                            {getMovementIcon(mov.tipo)} {mov.tipo}
                          </TableCell>
                          <TableCell data-label="Origem" className="capitalize">{mov.origem}</TableCell>
                          <TableCell data-label="Cliente">
                            {getClientDisplayName(mov.cliente)}
                          </TableCell>
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
                                {/* Botão Visualizar */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 rounded-xl" onClick={() => handleViewMovimentacao(mov)}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                    <p>Visualizar movimentação</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Botão Editar */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className={`text-yellow-400 hover:text-yellow-300 rounded-xl ${isVinculadaColeta ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                      onClick={() => !isVinculadaColeta && navigate(getEditRoute(mov))}
                                      disabled={isVinculadaColeta}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                    <p>{isVinculadaColeta ? "Movimentações de coletas devem ser editadas na coleta de origem." : "Editar movimentação"}</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Botão Excluir - Lógica condicional */}
                                {isVinculadaColeta ? (
                                  // Botão desabilitado quando vinculado a coleta
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="opacity-50 cursor-not-allowed text-red-400 rounded-xl"
                                        disabled
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                      <p>Movimentações de coletas devem ser excluídas na coleta de origem.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  // Botão habilitado com AlertDialog quando NÃO vinculado a coleta
                                  <AlertDialog>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 rounded-xl">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                        <p>Excluir movimentação</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-emerald-300">
                                          Essa ação não pode ser desfeita. Isso deletará permanentemente a movimentação.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(mov.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
                                          Deletar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
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