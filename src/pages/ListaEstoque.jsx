import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter, TableHead } from '@/components/ui/table';
import { Loader2, Search, Warehouse, CalendarIcon, ChevronUp, ChevronDown, Package, ArrowDownSquare, ArrowUpSquare } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import { Pagination } from '@/components/ui/pagination';
import { formatNumber, formatDateWithTimezone, cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

const ListaEstoque = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [sortConfig, setSortConfig] = useState({ key: 'data', direction: 'desc' });
  
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

    const startDateISO = debouncedStartDate || null;
    const endDateISO = debouncedEndDate || null;

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: typeFilter === 'all' ? null : typeFilter,
      p_product_search_term: debouncedProductSearchTerm || null,
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
    const { data: countData, error: countError } = await supabase.rpc('get_estoque_detailed_report_count', commonRpcParams);

    if (entriesError) {
      toast({ title: 'Erro ao buscar movimentações de estoque', description: `Falha na consulta: ${entriesError.message}`, variant: 'destructive' });
      setEntries([]);
      setTotalCount(0);
    } else if (countError) {
      toast({ title: 'Erro ao buscar contagem de movimentações', description: `Falha na consulta de contagem: ${countError.message}`, variant: 'destructive' });
      setEntries(entriesData || []);
      setTotalCount(0);
    } else {
      setEntries(entriesData || []);
      setTotalCount(countData || 0);
    }
    setLoading(false);
  }, [toast, currentPage, pageSize, typeFilter, debouncedProductSearchTerm, debouncedStartDate, debouncedEndDate, empresa, sortConfig]);

  const fetchSummary = useCallback(async () => {
    if (!empresa) return;
    let { data, error } = await supabase.rpc('get_estoque_summary', {
      p_start_date: debouncedStartDate || null,
      p_end_date: debouncedEndDate || null,
      p_type: typeFilter === 'all' ? null : typeFilter,
      p_product_search_term: debouncedProductSearchTerm || null,
    });

    if (error) {
      console.error("Erro ao buscar resumo de estoque:", error);
      setSummary({ total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
    } else {
      setSummary(data || { total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
    }
  }, [typeFilter, debouncedStartDate, debouncedEndDate, empresa, debouncedProductSearchTerm]);

  useEffect(() => {
    if (empresa) {
      fetchEntries();
      fetchSummary();
    }
  }, [fetchEntries, fetchSummary, empresa]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedProductSearchTerm, typeFilter, debouncedStartDate, debouncedEndDate, pageSize, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getTypeBadge = (type) => {
    switch (type) {
      case 'entrada':
        return 'bg-green-500/20 text-green-300';
      case 'saida':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <>
      <Helmet><title>Relatório de Estoque - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Warehouse className="w-8 h-8 text-emerald-400" /> Relatório de Estoque
            </h1>
            <p className="text-emerald-200/80 mt-1">Analise as movimentações de estoque da empresa com filtros avançados.</p>
          </div>
          <Button onClick={() => toast({ title: 'Funcionalidade em desenvolvimento', description: 'A exportação para Excel será implementada em breve.', variant: 'default' })} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            Exportar
          </Button>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="productSearchTerm" className="block text-white mb-1 text-sm">Produto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="productSearchTerm"
                  type="search"
                  placeholder="Buscar produto..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="typeFilter" className="block text-white mb-1 text-sm">Tipo de Movimentação</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
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
                    <TableHeaderSortable columnKey="tipo" label="Tipo" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHeaderSortable columnKey="document_number" label="Documento" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHead className="p-2 text-left text-white">Origem</TableHead>
                    <TableHeaderSortable columnKey="produto_nome" label="Produto" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHeaderSortable columnKey="quantidade" label="Quantidade" sortConfig={sortConfig} onSort={requestSort} className="text-right" />
                    <TableHead className="p-2 text-left text-white">Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length > 0 ? (
                    entries.map(entry => (
                      <TableRow key={entry.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Data">{formatDateWithTimezone(entry.data, empresa?.timezone)}</TableCell>
                        <TableCell data-label="Tipo">
                          <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getTypeBadge(entry.tipo)}`}>
                            {entry.tipo === 'entrada' ? <ArrowDownSquare className="inline-block h-3 w-3 mr-1" /> : <ArrowUpSquare className="inline-block h-3 w-3 mr-1" />}
                            {entry.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </span>
                        </TableCell>
                        <TableCell data-label="Documento">{entry.document_number || 'N/A'}</TableCell>
                        <TableCell data-label="Origem">{entry.origem}</TableCell>
                        <TableCell data-label="Produto">
                          <div className="font-medium">{entry.produto_nome}</div>
                          <div className="text-xs text-gray-400">{entry.produto_codigo}</div>
                        </TableCell>
                        <TableCell data-label="Quantidade" className="text-right">{formatNumber(entry.quantidade)} {entry.produto_unidade}</TableCell>
                        <TableCell data-label="Observação" className="text-xs">{entry.observacao || 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan="7" className="text-center text-gray-400 py-10">Nenhum dado de estoque encontrado para os filtros selecionados.</TableCell></TableRow>
                  )}
                </TableBody>
                {entries.length > 0 && (
                  <TableFooter>
                    <TableRow className="bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm hidden md:table-row">
                      <TableCell colSpan={4} className="p-2">TOTAIS DO PERÍODO</TableCell>
                      <TableCell className="text-right p-2">Entradas: {formatNumber(summary.total_quantity_in)}</TableCell>
                      <TableCell className="text-right p-2">Saídas: {formatNumber(summary.total_quantity_out)}</TableCell>
                      <TableCell colSpan={1} className="p-2"></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
            </div>
            {entries.length > 0 && !loading && (
              <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-0 rounded-b-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span>Total de Entradas:</span>
                  <span>{formatNumber(summary.total_quantity_in)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total de Saídas:</span>
                  <span>{formatNumber(summary.total_quantity_out)}</span>
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

export default ListaEstoque;