import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, BarChart2, Search, Warehouse, ArrowDownSquare, ArrowUpSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, subDays, endOfDay, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { formatNumber, formatDateWithTimezone, getZonedStartOfMonth, getZonedEndOfMonth } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DatePicker } from '@/components/ui/date-picker';
import ProdutoSearchableSelect from '@/components/produtos/ProdutoSearchableSelect';

const RelatorioEstoquePage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    type: 'all', // 'entrada', 'saida', 'all'
    productSearchTerm: '',
    selectedProductId: null, // For ProdutoSearchableSelect
  });
  const [summary, setSummary] = useState({ total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
  const [chartData, setChartData] = useState([]);
  const { toast } = useToast();
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);
  const empresaTimezone = useMemo(() => empresa?.timezone || 'America/Sao_Paulo', [empresa]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [empresaRes] = await Promise.all([
          supabase.from('empresa').select('items_per_page, timezone').single(),
        ]);

        if (empresaRes.error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
        else {
          const empresaData = empresaRes.data || { items_per_page: 25, timezone: 'America/Sao_Paulo' };
          setEmpresa(empresaData);
          setFilters(prev => ({
            ...prev,
            startDate: getZonedStartOfMonth(empresaData.timezone),
            endDate: getZonedEndOfMonth(empresaData.timezone)
          }));
        }

      } catch (error) {
        toast({ title: 'Erro ao carregar dados iniciais', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const startDateISO = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null;
    const endDateISO = filters.endDate ? format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;

    // Use selectedProductId for product search term if available, otherwise use productSearchTerm
    let effectiveProductSearchTerm = filters.productSearchTerm;
    if (filters.selectedProductId) {
      const { data: productData, error: productError } = await supabase.from('produtos').select('nome').eq('id', filters.selectedProductId).single();
      if (productError) {
        console.error("Erro ao buscar nome do produto para filtro:", productError);
        effectiveProductSearchTerm = null; // Fallback if product name can't be fetched
      } else {
        effectiveProductSearchTerm = productData?.nome;
      }
    }

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: filters.type === 'all' ? null : filters.type,
      p_product_search_term: effectiveProductSearchTerm || null,
    };

    try {
      // Fetch Summary
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_estoque_summary', commonRpcParams);
      if (summaryError) throw summaryError;
      setSummary(summaryData || { total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });

      // Fetch Chart Data
      const { data: chartDataRes, error: chartError } = await supabase.rpc('get_estoque_chart_data', commonRpcParams);
      if (chartError) throw chartError;
      setChartData(chartDataRes || []);

      // Fetch Detailed Report Data
      const { data: detailedData, error: detailedError, count } = await supabase.rpc('get_estoque_detailed_report', {
        ...commonRpcParams,
        p_offset: from,
        p_limit: pageSize,
      });

      if (detailedError) throw detailedError;
      setReportData(detailedData || []);
      setTotalCount(count || 0);

    } catch (error) {
      toast({ title: 'Erro ao gerar relatório de estoque', description: error.message, variant: 'destructive' });
      setReportData([]);
      setSummary({ total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
      setChartData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [empresa, currentPage, pageSize, filters, debouncedFilters, toast]);

  useEffect(() => {
    if (empresa) {
      fetchReportData();
    }
  }, [fetchReportData, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters, pageSize]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSelect = (product) => {
    setFilters(prev => ({
      ...prev,
      selectedProductId: product ? product.id : null,
      productSearchTerm: product ? product.nome : '' // Keep text input updated
    }));
  };

  const handleExportExcel = async () => {
    if (totalCount === 0) {
      toast({ title: 'Nenhum dado para exportar', description: 'Filtre os dados que deseja exportar.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    let allData = [];
    const totalPagesToFetch = Math.ceil(totalCount / 500); // Fetch in chunks

    const startDateISO = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null;
    const endDateISO = filters.endDate ? format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;

    let effectiveProductSearchTerm = filters.productSearchTerm;
    if (filters.selectedProductId) {
      const { data: productData, error: productError } = await supabase.from('produtos').select('nome').eq('id', filters.selectedProductId).single();
      if (productError) {
        console.error("Erro ao buscar nome do produto para exportação:", productError);
        effectiveProductSearchTerm = null;
      } else {
        effectiveProductSearchTerm = productData?.nome;
      }
    }

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: filters.type === 'all' ? null : filters.type,
      p_product_search_term: effectiveProductSearchTerm || null,
    };

    for (let i = 0; i < totalPagesToFetch; i++) {
      const { data, error } = await supabase.rpc('get_estoque_detailed_report', {
        ...commonRpcParams,
        p_offset: i * 500,
        p_limit: 500,
      });
      if (error) {
        toast({ title: 'Erro ao exportar dados', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      allData = [...allData, ...data];
    }
    setLoading(false);

    const dataToExport = allData.map(item => ({
      'Data': formatDateWithTimezone(item.data, empresaTimezone),
      'Tipo': item.tipo === 'entrada' ? 'Entrada' : 'Saída',
      'Origem': item.origem,
      'Nº Documento': item.document_number || 'N/A',
      'Cliente/Fornecedor': item.cliente_nome_fantasia ? `${item.cliente_nome} - ${item.cliente_nome_fantasia}` : item.cliente_nome || 'N/A',
      'Produto': item.produto_nome,
      'Código Produto': item.produto_codigo || 'N/A',
      'Quantidade': formatNumber(item.quantidade),
      'Unidade': item.produto_unidade,
      'Observação': item.observacao || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioEstoque');
    XLSX.writeFile(workbook, 'Relatorio_Estoque.xlsx');
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800/80 border border-gray-600 rounded-xl text-white">
          <p className="label font-bold">{`Mês: ${label}`}</p>
          <p className="text-green-400">{`Entradas : ${formatNumber(payload[0].value)}`}</p>
          <p className="text-red-400">{`Saídas : ${formatNumber(payload[1].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet><title>Relatório de Estoque - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-8 h-8 text-emerald-400" /> Relatório de Estoque
            </h1>
            <p className="text-emerald-200/80 mt-1">Analise as movimentações de estoque da empresa com filtros avançados.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleExportExcel} disabled={totalCount === 0 || loading} variant="outline" className="flex-grow sm:flex-grow-0 rounded-xl">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} Exportar
            </Button>
          </div>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl relative z-20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="lg:col-span-2"> {/* Produto ocupa 2 colunas */}
                <ProdutoSearchableSelect
                  labelText="Produto"
                  value={filters.selectedProductId}
                  onChange={handleProductSelect}
                  placeholder="Buscar por produto..."
                />
              </div>
              <div>
                <Label htmlFor="typeFilter" className="block text-white mb-1 text-sm">Tipo de Movimentação</Label>
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
              <div className="grid grid-cols-2 gap-4"> {/* Datas agrupadas em 2 colunas */}
                <div>
                  <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
                  <DatePicker
                    date={filters.startDate}
                    setDate={(date) => handleFilterChange('startDate', date)}
                    className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
                  <DatePicker
                    date={filters.endDate}
                    setDate={(date) => handleFilterChange('endDate', date)}
                    className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {(loading || !empresa) && (
          <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>
        )}

        {!(loading || !empresa) && (
          <div className="space-y-6">
            {reportData.length > 0 && (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Total de Movimentações</CardTitle>
                      <Warehouse className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary.total_movements}</div>
                      <p className="text-xs text-gray-400">Registros no período</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Quantidade Total de Entrada</CardTitle>
                      <ArrowDownSquare className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(summary.total_quantity_in)}</div>
                      <p className="text-xs text-gray-400">Soma das quantidades de entrada</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Quantidade Total de Saída</CardTitle>
                      <ArrowUpSquare className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="2xl font-bold">{formatNumber(summary.total_quantity_out)}</div>
                      <p className="text-xs text-gray-400">Soma das quantidades de saída</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-emerald-300">Evolução Mensal de Movimentações</CardTitle>
                    <CardDescription className="text-gray-400">
                      Quantidades de entrada e saída por mês no período selecionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="month_year" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" tickFormatter={(value) => formatNumber(value)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: '#fff' }} />
                        <Bar dataKey="total_quantity_in" fill="#34d399" name="Entradas" />
                        <Bar dataKey="total_quantity_out" fill="#ef4444" name="Saídas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                  <CardHeader><CardTitle className="text-emerald-300">Detalhes das Movimentações</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="responsive-table">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                            <th className="p-2 text-left text-white">Data</th>
                            <th className="p-2 text-left text-white">Tipo</th>
                            <th className="p-2 text-left text-white">Origem</th>
                            <th className="p-2 text-left text-white">Nº Doc</th>
                            <th className="p-2 text-left text-white">Cliente/Fornecedor</th>
                            <th className="p-2 text-left text-white">Produto</th>
                            <th className="p-2 text-right text-white">Quantidade</th>
                            <th className="p-2 text-left text-white">Unidade</th>
                            <th className="p-2 text-left text-white">Observação</th>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map(item => (
                            <TableRow key={item.id + item.produto_id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                              <TableCell data-label="Data">{formatDateWithTimezone(item.data, empresaTimezone)}</TableCell>
                              <TableCell data-label="Tipo" className="capitalize">{item.tipo === 'entrada' ? 'Entrada' : 'Saída'}</TableCell>
                              <TableCell data-label="Origem" className="capitalize">{item.origem}</TableCell>
                              <TableCell data-label="Nº Doc">{item.document_number || 'N/A'}</TableCell>
                              <TableCell data-label="Cliente/Fornecedor">{item.cliente_nome_fantasia ? `${item.cliente_nome} - ${item.cliente_nome_fantasia}` : item.cliente_nome || 'N/A'}</TableCell>
                              <TableCell data-label="Produto">{item.produto_nome}</TableCell>
                              <TableCell data-label="Quantidade" className="text-right">{formatNumber(item.quantidade)}</TableCell>
                              <TableCell data-label="Unidade" className="capitalize">{item.produto_unidade}</TableCell>
                              <TableCell data-label="Observação" className="text-xs">{item.observacao || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            {reportData.length === 0 && !loading && (
              <div className="text-center py-10 text-gray-400">
                <p>Nenhum dado de estoque encontrado para os filtros selecionados.</p>
              </div>
            )}
          </div>
        )}
        {!(loading || !empresa) && (
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

export default RelatorioEstoquePage;