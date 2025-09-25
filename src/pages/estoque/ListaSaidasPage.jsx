import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, Search, ArrowUpSquare, Eye } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import ProdutoSearchableSelect from '@/components/estoque/ProdutoSearchableSelect';
import { formatNumber } from '@/lib/utils';
import MovimentacaoViewDialog from '@/components/estoque/MovimentacaoViewDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

const ListaSaidasPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    searchTerm: '',
    clientSearchTerm: '',
    selectedProdutoId: null,
    startDate: '',
    endDate: '',
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
        document_number,
        observacao,
        cliente:clientes(nome, nome_fantasia),
        itens_entrada_saida(
          id,
          quantidade,
          produto:produtos(id, nome, unidade, codigo)
        )
      `, { count: 'exact' })
      .eq('tipo', 'saida')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (debouncedFilters.searchTerm) {
      query = query.or(`observacao.ilike.%${debouncedFilters.searchTerm}%,document_number.ilike.%${debouncedFilters.searchTerm}%`);
    }
    if (debouncedFilters.clientSearchTerm) {
      query = query.or(`cliente.nome.ilike.%${debouncedFilters.clientSearchTerm}%,cliente.nome_fantasia.ilike.%${debouncedFilters.clientSearchTerm}%`);
    }
    if (debouncedFilters.startDate) {
      query = query.gte('data', debouncedFilters.startDate);
    }
    if (debouncedFilters.endDate) {
      query = query.lte('data', debouncedFilters.endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao buscar saídas', description: error.message, variant: 'destructive' });
      setMovimentacoes([]);
    } else {
      let filteredData = data || [];
      if (debouncedFilters.selectedProdutoId) {
        filteredData = filteredData.filter(mov =>
          mov.itens_entrada_saida.some(item => item.produto.id === debouncedFilters.selectedProdutoId)
        );
      }
      setMovimentacoes(filteredData);
      setTotalCount(count || 0);
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
      toast({ title: 'Erro ao deletar saída', description: error.message, variant: 'destructive' });
    } else {
      await logAction('delete_stock_exit', { movimentacao_id: id });
      toast({ title: 'Saída deletada com sucesso' });
      fetchMovimentacoes();
    }
  };

  const handleViewMovimentacao = (mov) => {
    setViewingMovimentacao(mov);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet><title>Saídas de Estoque - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <ArrowUpSquare className="w-8 h-8 text-emerald-400" /> Saídas de Estoque
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie as saídas de produtos do estoque.</p>
          </div>
          <Button onClick={() => navigate('/app/estoque/saidas/novo')} className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova Saída
          </Button>
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
                  placeholder="Nº Doc, Observação..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
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
                  value={filters.clientSearchTerm}
                  onChange={(e) => handleFilterChange('clientSearchTerm', e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <ProdutoSearchableSelect
                labelText="Produto"
                value={filters.selectedProdutoId}
                onChange={(product) => handleFilterChange('selectedProdutoId', product ? product.id : null)}
              />
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
                    <th className="p-2 text-left text-white">Nº Documento</th>
                    <th className="p-2 text-left text-white">Data</th>
                    <th className="p-2 text-left text-white">Cliente</th>
                    <th className="p-2 text-left text-white">Origem</th>
                    <th className="p-2 text-left text-white">Itens</th>
                    <th className="p-2 text-right text-white">Ações</th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movimentacoes.length > 0 ? (
                    movimentacoes.map(mov => (
                      <TableRow key={mov.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Nº Documento">{mov.document_number || 'N/A'}</TableCell>
                        <TableCell data-label="Data">{format(parseISO(mov.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        <TableCell data-label="Cliente">{mov.cliente?.nome_fantasia ? `${mov.cliente.nome} - ${mov.cliente.nome_fantasia}` : mov.cliente?.nome || 'N/A'}</TableCell>
                        <TableCell data-label="Origem" className="capitalize">{mov.origem}</TableCell>
                        <TableCell data-label="Itens">
                          {mov.itens_entrada_saida.map((item, idx) => (
                            <div key={idx} className="text-xs">
                              {item.produto.nome}: {formatNumber(item.quantidade)} {item.produto.unidade}
                            </div>
                          ))}
                        </TableCell>
                        <TableCell className="text-right actions-cell">
                           <div className="flex justify-end items-center gap-2">
                            <Button variant="ghost" size="icon" className="text-blue-400 hover:text-blue-300 rounded-xl" onClick={() => handleViewMovimentacao(mov)}><Eye className="h-4 w-4" /></Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`text-yellow-400 hover:text-yellow-300 rounded-xl ${mov.origem === 'coleta' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => navigate(`/app/estoque/saidas/editar/${mov.id}`)}
                                    disabled={mov.origem === 'coleta'}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                {mov.origem === 'coleta' && (
                                  <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                    <p>Movimentações de coleta devem ser editadas na coleta de origem.</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-emerald-300">Essa ação não pode ser desfeita. Isso deletará permanentemente a saída de estoque.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(mov.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">Deletar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                           </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan="6" className="text-center text-gray-400 py-10">Nenhuma saída encontrada.</TableCell></TableRow>
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

export default ListaSaidasPage;