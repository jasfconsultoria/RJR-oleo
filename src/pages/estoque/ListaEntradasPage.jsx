import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter, TableHead } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, Search, ArrowDownSquare, ChevronUp, ChevronDown, Package } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { formatCurrency, formatNumber, formatDateWithTimezone, cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper component for sortable table headers
const TableHeaderSortable = ({ columnKey, label, sortConfig, onSort, className }) => {
  const getSortIcon = () => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4 ml-1" />
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  return (
    <TableHead
      onClick={() => onSort(columnKey)}
      className={cn("cursor-pointer text-emerald-300", className)}
    >
      <div className="flex items-center">
        {label} {getSortIcon()}
      </div>
    </TableHead>
  );
};

const ListaEntradasPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedProductSearchTerm = useDebounce(productSearchTerm, 500);
  const debouncedStartDate = useDebounce(startDate ? format(startDate, 'yyyy-MM-dd') : null, 500);
  const debouncedEndDate = useDebounce(endDate ? format(endDate, 'yyyy-MM-dd') : null, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const [summary, setSummary] = useState({ total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page, timezone').single();
      if (error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
      else setEmpresa(data || { items_per_page: 25, timezone: 'America/Sao_Paulo' });
    };
    fetchEmpresa();
  }, [toast]);

  const fetchEntries = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    const from = (currentPage - 1) * pageSize;

    const commonRpcParams = {
      p_start_date: debouncedStartDate || null,
      p_end_date: debouncedEndDate || null,
      p_type: 'entrada',
      p_product_search_term: debouncedProductSearchTerm || debouncedSearchTerm || null,
    };

    // Fetch paginated data
    const { data: entriesData, error: entriesError } = await supabase.rpc('get_estoque_detailed_report', {
      ...commonRpcParams,
      p_offset: from,
      p_limit: pageSize,
      p_sort_column: sortConfig.key,
      p_sort_direction: sortConfig.direction,
    });

    // Fetch total count
    const { count, error: countError } = await supabase
      .from('entrada_saida')
      .select('*', { count: 'exact' })
      .eq('tipo', 'entrada')
      .gte('data', debouncedStartDate || '1900-01-01')
      .lte('data', debouncedEndDate ? format(endOfDay(parseISO(debouncedEndDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : '2100-01-01');

    if (entriesError) {
      toast({ title: 'Erro ao buscar entradas', description: `Falha na consulta: ${entriesError.message}`, variant: 'destructive' });
      setEntries([]);
      setTotalCount(0);
    } else if (countError) {
      toast({ title: 'Erro ao buscar contagem de entradas', description: `Falha na consulta de contagem: ${countError.message}`, variant: 'destructive' });
      setEntries(entriesData || []);
      setTotalCount(0);
    } else {
      setEntries(entriesData || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [toast, currentPage, pageSize, debouncedSearchTerm, debouncedProductSearchTerm, debouncedStartDate, debouncedEndDate, empresa, sortConfig]);

  const fetchSummary = useCallback(async () => {
    if (!empresa) return;
    let { data, error } = await supabase.rpc('get_estoque_summary', {
      p_start_date: debouncedStartDate || null,
      p_end_date: debouncedEndDate || null,
      p_type: 'entrada',
      p_product_search_term: debouncedProductSearchTerm || debouncedSearchTerm || null,
    });

    if (error) {
      console.error("Erro ao buscar resumo de estoque:", error);
      setSummary({ total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
    } else {
      setSummary(data || { total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
    }
  }, [debouncedStartDate, debouncedEndDate, debouncedProductSearchTerm, debouncedSearchTerm, empresa]);

  useEffect(() => {
    if (empresa) {
      fetchEntries();
      fetchSummary();
    }
  }, [fetchEntries, fetchSummary, empresa]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, debouncedProductSearchTerm, debouncedStartDate, debouncedEndDate, pageSize, sortConfig]);

  // Função auxiliar para verificar se a entrada está vinculada a coleta
  const isEntradaVinculadaColeta = (entrada) => {
    return entrada.origem === 'coleta' || entrada.coleta_id != null;
  };

  const handleDelete = async (id, documentNumber) => {
    const { error } = await supabase.from('entrada_saida').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao deletar entrada', description: error.message, variant: 'destructive' });
    } else {
      await logAction('delete_stock_entry', { details: { entry_id: id, document_number: documentNumber } });
      toast({ title: 'Entrada deletada com sucesso' });
      fetchEntries();
      fetchSummary();
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

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet><title>Lista de Entradas - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <ArrowDownSquare className="w-8 h-8 text-emerald-400" /> Lista de Entradas
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie as entradas de produtos no estoque.</p>
          </div>
          <Button onClick={() => navigate('/app/estoque/entradas/novo')} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova Entrada
          </Button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar Documento</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="searchTerm"
                  type="search"
                  placeholder="Nº Documento, observação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="productSearchTerm" className="block text-white mb-1 text-sm">Buscar Produto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="productSearchTerm"
                  type="search"
                  placeholder="Nome, código do produto..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 col-span-2">
              <div>
                <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
                <DatePicker
                  date={startDate}
                  setDate={setStartDate}
                  className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
                <DatePicker
                  date={endDate}
                  setDate={setEndDate}
                  className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <TableHeaderSortable columnKey="data" label="Data" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHeaderSortable columnKey="document_number" label="Documento" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHead className="p-2 text-left text-white">Origem</TableHead>
                    <TableHeaderSortable columnKey="produto_nome" label="Produto" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHeaderSortable columnKey="quantidade" label="Quantidade" sortConfig={sortConfig} onSort={requestSort} className="text-right" />
                    <TableHead className="p-2 text-left text-white">Observação</TableHead>
                    <TableHead className="p-2 text-right text-white">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length > 0 ? (
                    entries.map(entry => {
                      const isVinculadaColeta = isEntradaVinculadaColeta(entry);

                      return (
                        <TableRow key={entry.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Data">{formatDateWithTimezone(entry.data, empresa?.timezone)}</TableCell>
                          <TableCell data-label="Documento">{entry.document_number || 'N/A'}</TableCell>
                          <TableCell data-label="Origem">{entry.origem}</TableCell>
                          <TableCell data-label="Produto">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-emerald-400" />
                              <span>{entry.produto_nome} ({entry.produto_codigo})</span>
                            </div>
                          </TableCell>
                          <TableCell data-label="Quantidade" className="text-right">{formatNumber(entry.quantidade)} {entry.produto_unidade}</TableCell>
                          <TableCell data-label="Observação" className="max-w-[200px] truncate">{entry.observacao || 'N/A'}</TableCell>
                          <TableCell className="text-right actions-cell">
                            <TooltipProvider>
                              <div className="flex justify-end items-center gap-2">
                                {/* Botão Editar - Lógica condicional */}
                                {isVinculadaColeta ? (
                                  // Botão desabilitado quando vinculado a coleta
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="opacity-50 cursor-not-allowed text-yellow-400 rounded-xl"
                                        disabled
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                      <p>Entradas de coletas devem ser editadas na coleta de origem.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  // Botão habilitado quando NÃO vinculado a coleta
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        title="Editar Entrada" 
                                        className="text-yellow-400 hover:text-yellow-300 rounded-xl" 
                                        onClick={() => navigate(`/app/estoque/entradas/editar/${entry.id}`)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                      <p>Editar entrada</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}

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
                                      <p>Entradas de coletas devem ser excluídas na coleta de origem.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  // Botão habilitado com AlertDialog quando NÃO vinculado a coleta
                                  <AlertDialog>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertDialogTrigger asChild>
                                          <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="text-red-400 hover:text-red-300 rounded-xl"
                                            title="Excluir Entrada"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                        <p>Excluir entrada</p>
                                      </TooltipContent>
                                    </Tooltip>
                                    <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-emerald-300">
                                          Esta ação não pode ser desfeita. Isso deletará permanentemente a entrada {entry.document_number || entry.observacao}.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(entry.id, entry.document_number)} className="bg-red-500 hover:bg-red-600 rounded-xl">Deletar</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan="7" className="text-center text-gray-400 py-10">Nenhuma entrada encontrada.</TableCell></TableRow>
                  )}
                </TableBody>
                {entries.length > 0 && (
                  <TableFooter>
                    <TableRow className="bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm hidden md:table-row">
                      <TableCell colSpan={4} className="p-2">Total de Entradas (Período)</TableCell>
                      <TableCell className="text-right p-2">{formatNumber(summary.total_quantity_in)} kg</TableCell>
                      <TableCell colSpan={2} className="p-2"></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
            </div>
            {entries.length > 0 && !loading && (
              <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-0 rounded-b-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span>Total de Entradas (Período):</span>
                  <span>{formatNumber(summary.total_quantity_in)} kg</span>
                </div>
              </div>
            )}
        </div>

        {totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            totalCount={totalCount}
          />
        )}
      </div>
    </>
  );
};

export default ListaEntradasPage;