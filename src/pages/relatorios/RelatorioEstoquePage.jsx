import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, BarChart2, Search, ArrowDownSquare, ArrowUpSquare, ListChecks } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { formatNumber, formatDateWithTimezone } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { DatePicker } from '@/components/ui/date-picker';
import ProdutoSearchableSelect from '@/components/estoque/ProdutoSearchableSelect';

const RelatorioEstoquePage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    productSearchTerm: '',
    type: 'all', // 'entrada', 'saida', 'all'
  });
  const [summary, setSummary] = useState({ total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });
  const { toast } = useToast();
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);
  const empresaTimezone = useMemo(() => empresa?.timezone || 'America/Sao_Paulo', [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page, timezone').single();
      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ title: "Erro ao buscar configurações da empresa.", variant: "destructive" });
      }
      setEmpresa(data || { items_per_page: 25, timezone: 'America/Sao_Paulo' });
    };
    fetchEmpresaData();
  }, [toast]);

  const fetchReportData = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);

    const from = (currentPage - 1) * pageSize;

    const startDateISO = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null;
    const endDateISO = filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : null;

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: filters.type === 'all' ? null : filters.type,
      p_product_search_term: debouncedFilters.productSearchTerm || null,
    };

    try {
      // Fetch Summary
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_estoque_summary', commonRpcParams);
      if (summaryError) throw summaryError;
      setSummary(summaryData || { total_movements: 0, total_quantity_in: 0, total_quantity_out: 0 });

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
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [empresa, currentPage, pageSize, filters.type, debouncedFilters.productSearchTerm, filters.startDate, filters.endDate, toast]);

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
    handleFilterChange('productSearchTerm', product ? product.nome : '');
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
    const endDateISO = filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : null;

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: filters.type === 'all' ? null : filters.type,
      p_product_search_term: debouncedFilters.productSearchTerm || null,
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
      'Cliente': item.cliente_nome_fantasia ? `${item.cliente_nome} - ${item.cliente_nome_fantasia}` : item.cliente_nome || 'N/A',
      'Produto': item.produto_nome,
      'Código Produto': item.produto_codigo || 'N/A',
      'Quantidade': formatNumber(item.quantidade),
      'Unidade': item.unidade,
      'Observação': item.observacao || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioEstoque');
    XLSX.writeFile(workbook, 'Relatorio_Estoque.xlsx');
  };

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
              <div>
                <ProdutoSearchableSelect
                  labelText="Produto"
                  value={filters.productSearchTerm}
                  onChange={handleProductSelect}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {(loading || !empresa) && (
          <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 text-emerald-400 animate-spin" /></div>
        )}

        {!(loading || !empresa) && (
          <div className="space-y-6">
            {reportData.length > 0 && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Total de Movimentações</CardTitle>
                      <ListChecks className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary.total_movements}</div>
                      <p className="text-xs text-gray-400">Registros no período</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Total de Entradas</CardTitle>
                      <ArrowDownSquare className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatNumber(summary.total_quantity_in)}</div>
                      <p className="text-xs text-gray-400">Quantidade total de produtos que entraram</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Total de Saídas</CardTitle>
                      <ArrowUpSquare className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="2xl font-bold">{formatNumber(summary.total_quantity_out)}</div>
                      <p className="text-xs text-gray-400">Quantidade total de produtos que saíram</p>
                    </CardContent>
                  </Card>
                </div>

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
                            <th className="p-2 text-left text-white">Cliente</th>
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
                              <TableCell data-label="Cliente">{item.cliente_nome_fantasia ? `${item.cliente_nome} - ${item.cliente_nome_fantasia}` : item.cliente_nome || 'N/A'}</TableCell>
                              <TableCell data-label="Produto">{item.produto_nome}</TableCell>
                              <TableCell data-label="Quantidade" className="text-right">{formatNumber(item.quantidade)}</TableCell>
                              <TableCell data-label="Unidade" className="capitalize">{item.unidade}</TableCell>
                              <TableCell data-label="Observação">{item.observacao || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="hover:bg-transparent border-t-2 border-emerald-500 font-bold hidden md:table-row">
                            <TableCell colSpan={6}>Totais (Página)</TableCell>
                            <TableCell className="text-right">{formatNumber(reportData.reduce((sum, item) => sum + item.quantidade, 0))}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                      <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span>Total Quantidade (Página):</span>
                          <span>{formatNumber(reportData.reduce((sum, item) => sum + item.quantidade, 0))}</span>
                        </div>
                      </div>
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