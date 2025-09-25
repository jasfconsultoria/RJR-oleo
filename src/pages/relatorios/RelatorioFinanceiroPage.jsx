import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, BarChart2, Search, DollarSign, TrendingUp, TrendingDown, Tag } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useProfile } from '@/contexts/ProfileContext';
import { format, subDays, endOfDay, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { formatCurrency, formatNumber, formatDateWithTimezone } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DatePicker } from '@/components/ui/date-picker';

const RelatorioFinanceiroPage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
    type: 'all', // 'credito', 'debito', 'all'
    status: 'all', // 'pending', 'partially_paid', 'paid', 'overdue', 'canceled', 'all'
    clientSearchTerm: '',
    costCenter: 'all',
  });
  const [summary, setSummary] = useState({ total_entries: 0, total_value: 0, total_paid: 0, total_balance: 0 });
  const [chartData, setChartData] = useState([]);
  const [clients, setClients] = useState([]);
  const [costCenters, setCostCenters] = useState([]);
  const { toast } = useToast();
  const { profile } = useProfile();
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);
  const empresaTimezone = useMemo(() => empresa?.timezone || 'America/Sao_Paulo', [empresa]);

  const clientOptions = useMemo(() => {
    return [{ value: 'all', label: 'Todos os Clientes/Fornecedores' }, ...clients.map(client => ({
      value: client.id,
      label: client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome,
    }))];
  }, [clients]);

  const costCenterOptions = useMemo(() => {
    return [{ value: 'all', label: 'Todos os Centros de Custo' }, ...costCenters.map(cc => ({
      value: cc.nome,
      label: cc.nome,
    }))];
  }, [costCenters]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [empresaRes, clientsRes, costCentersRes] = await Promise.all([
          supabase.from('empresa').select('items_per_page, timezone').single(),
          supabase.from('clientes').select('id, nome, nome_fantasia').order('nome', { ascending: true }),
          supabase.from('centro_custos').select('nome').order('nome', { ascending: true }),
        ]);

        if (empresaRes.error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
        else setEmpresa(empresaRes.data || { items_per_page: 25, timezone: 'America/Sao_Paulo' });

        if (clientsRes.error) toast({ title: 'Erro ao buscar clientes/fornecedores', variant: 'destructive' });
        else setClients(clientsRes.data || []);

        if (costCentersRes.error) toast({ title: 'Erro ao buscar centros de custo', variant: 'destructive' });
        else setCostCenters(costCentersRes.data || []);

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

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: filters.type === 'all' ? null : filters.type,
      p_status: filters.status === 'all' ? null : filters.status,
      p_client_search_term: debouncedFilters.clientSearchTerm || null,
      p_cost_center: filters.costCenter === 'all' ? null : filters.costCenter,
    };

    try {
      // Fetch Summary
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_financeiro_summary', commonRpcParams);
      if (summaryError) throw summaryError;
      setSummary(summaryData || { total_entries: 0, total_value: 0, total_paid: 0, total_balance: 0 });

      // Fetch Chart Data
      const { data: chartDataRes, error: chartError } = await supabase.rpc('get_financeiro_chart_data', commonRpcParams);
      if (chartError) throw chartError;
      setChartData(chartDataRes || []);

      // Fetch Detailed Report Data
      const { data: detailedData, error: detailedError, count } = await supabase.rpc('get_financeiro_detailed_report', {
        ...commonRpcParams,
        p_offset: from,
        p_limit: pageSize,
      });

      if (detailedError) throw detailedError;
      setReportData(detailedData || []);
      setTotalCount(count || 0);

    } catch (error) {
      toast({ title: 'Erro ao gerar relatório financeiro', description: error.message, variant: 'destructive' });
      setReportData([]);
      setSummary({ total_entries: 0, total_value: 0, total_paid: 0, total_balance: 0 });
      setChartData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [empresa, currentPage, pageSize, filters, debouncedFilters.clientSearchTerm, toast]);

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

    const commonRpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: filters.type === 'all' ? null : filters.type,
      p_status: filters.status === 'all' ? null : filters.status,
      p_client_search_term: debouncedFilters.clientSearchTerm || null,
      p_cost_center: filters.costCenter === 'all' ? null : filters.costCenter,
    };

    for (let i = 0; i < totalPagesToFetch; i++) {
      const { data, error } = await supabase.rpc('get_financeiro_detailed_report', {
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
      'Tipo': item.type === 'credito' ? 'Crédito' : 'Débito',
      'Nº Documento': item.document_number || 'N/A',
      'Modelo': item.model || 'N/A',
      'Cliente/Fornecedor': item.cliente_fornecedor_name_fantasia ? `${item.cliente_fornecedor_name} - ${item.cliente_fornecedor_name_fantasia}` : item.cliente_fornecedor_name,
      'CNPJ/CPF': item.cnpj_cpf || 'N/A',
      'Descrição': item.description,
      'Data Emissão': formatDateWithTimezone(item.issue_date, empresaTimezone),
      'Valor Total (R$)': formatNumber(item.total_value),
      'Valor Pago (R$)': formatNumber(item.paid_amount),
      'Saldo (R$)': formatNumber(item.amount_balance),
      'Forma Pagamento': item.payment_method || 'N/A',
      'Centro de Custo': item.cost_center || 'N/A',
      'Status': getStatusText(item.status),
      'Parcela': item.installment_number === 0 ? 'Entrada' : `${item.installment_number}/${item.total_installments}`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioFinanceiro');
    XLSX.writeFile(workbook, 'Relatorio_Financeiro.xlsx');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-500/20 text-green-300';
      case 'pending': return 'bg-yellow-500/20 text-yellow-300';
      case 'partially_paid': return 'bg-blue-500/20 text-blue-300';
      case 'overdue': return 'bg-red-500/20 text-red-300';
      case 'canceled': return 'bg-gray-500/20 text-gray-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Quitado';
      case 'pending': return 'Pendente';
      case 'partially_paid': return 'Parcialmente Pago';
      case 'overdue': return 'Vencido';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };

  const getClientDisplayName = (entry) => {
    return entry.cliente_fornecedor_name_fantasia ? `${entry.cliente_fornecedor_name} - ${entry.cliente_fornecedor_name_fantasia}` : entry.cliente_fornecedor_name;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800/80 border border-gray-600 rounded-xl text-white">
          <p className="label font-bold">{`Mês: ${label}`}</p>
          <p className="text-emerald-400">{`Valor Total : ${formatCurrency(payload[0].value)}`}</p>
          <p className="text-blue-400">{`Valor Pago : ${formatCurrency(payload[1].value)}`}</p>
          <p className="text-yellow-400">{`Saldo : ${formatCurrency(payload[2].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet><title>Relatório Financeiro - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-8 h-8 text-emerald-400" /> Relatório Financeiro
            </h1>
            <p className="text-emerald-200/80 mt-1">Analise os dados financeiros da empresa com filtros avançados.</p>
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
                <Label htmlFor="typeFilter" className="block text-white mb-1 text-sm">Tipo</Label>
                <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                    <SelectValue placeholder="Todos os Tipos" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="statusFilter" className="block text-white mb-1 text-sm">Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="partially_paid">Parcialmente Pago</SelectItem>
                    <SelectItem value="paid">Quitado</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="canceled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente/Fornecedor</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                  <Input
                    id="clientSearch"
                    type="search"
                    placeholder="Buscar por nome, CNPJ/CPF, descrição..."
                    value={filters.clientSearchTerm}
                    onChange={(e) => handleFilterChange('clientSearchTerm', e.target.value)}
                    className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="costCenterFilter" className="block text-white mb-1 text-sm">Centro de Custo</Label>
                <Select value={filters.costCenter} onValueChange={(value) => handleFilterChange('costCenter', value)}>
                  <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                    <SelectValue placeholder="Todos os Centros de Custo" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                    {costCenterOptions.map(cc => <SelectItem key={cc.value} value={cc.value}>{cc.label}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Total de Lançamentos</CardTitle>
                      <BarChart2 className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{summary.total_entries}</div>
                      <p className="text-xs text-gray-400">Registros no período</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Valor Total</CardTitle>
                      <DollarSign className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(summary.total_value)}</div>
                      <p className="text-xs text-gray-400">Soma dos valores dos lançamentos</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Total Pago</CardTitle>
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(summary.total_paid)}</div>
                      <p className="text-xs text-gray-400">Soma dos valores já pagos</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-300">Saldo Total</CardTitle>
                      <TrendingDown className="h-4 w-4 text-gray-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(summary.total_balance)}</div>
                      <p className="text-xs text-gray-400">Valor restante a pagar/receber</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-emerald-300">Evolução Mensal</CardTitle>
                    <CardDescription className="text-gray-400">
                      Valores totais, pagos e saldo por mês no período selecionado.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis dataKey="month_year" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: '#fff' }} />
                        <Bar dataKey="total_value" fill="#34d399" name="Valor Total" />
                        <Bar dataKey="total_paid" fill="#60a5fa" name="Valor Pago" />
                        <Bar dataKey="total_balance" fill="#fbbf24" name="Saldo" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                  <CardHeader><CardTitle className="text-emerald-300">Detalhes dos Lançamentos</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="responsive-table">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                            <th className="p-2 text-left text-white">Tipo</th>
                            <th className="p-2 text-left text-white">Nº Doc</th>
                            <th className="p-2 text-left text-white">Cliente/Fornecedor</th>
                            <th className="p-2 text-left text-white">Descrição</th>
                            <th className="p-2 text-left text-white">Emissão</th>
                            <th className="p-2 text-right text-white">Valor</th>
                            <th className="p-2 text-right text-white">Pago</th>
                            <th className="p-2 text-right text-white">Saldo</th>
                            <th className="p-2 text-center text-white">Status</th>
                            <th className="p-2 text-left text-white">Centro Custo</th>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map(item => (
                            <TableRow key={item.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                              <TableCell data-label="Tipo" className="capitalize">{item.type === 'credito' ? 'Crédito' : 'Débito'}</TableCell>
                              <TableCell data-label="Nº Doc">{item.document_number || 'N/A'}</TableCell>
                              <TableCell data-label="Cliente/Fornecedor">{getClientDisplayName(item)}</TableCell>
                              <TableCell data-label="Descrição">{item.description}</TableCell>
                              <TableCell data-label="Emissão">{formatDateWithTimezone(item.issue_date, empresaTimezone)}</TableCell>
                              <TableCell data-label="Valor" className="text-right">{formatCurrency(item.total_value)}</TableCell>
                              <TableCell data-label="Pago" className="text-right">{formatCurrency(item.paid_amount)}</TableCell>
                              <TableCell data-label="Saldo" className="text-right font-bold">{formatCurrency(item.amount_balance)}</TableCell>
                              <TableCell data-label="Status" className="text-center">
                                <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getStatusBadge(item.status)}`}>
                                  {getStatusText(item.status)}
                                </span>
                              </TableCell>
                              <TableCell data-label="Centro Custo">{item.cost_center || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="hover:bg-transparent border-t-2 border-emerald-500 font-bold hidden md:table-row">
                            <TableCell colSpan={5}>Totais (Página)</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportData.reduce((sum, item) => sum + item.total_value, 0))}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportData.reduce((sum, item) => sum + item.paid_amount, 0))}</TableCell>
                            <TableCell className="text-right">{formatCurrency(reportData.reduce((sum, item) => sum + item.amount_balance, 0))}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                      <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span>Valor Total (Página):</span>
                          <span>{formatCurrency(reportData.reduce((sum, item) => sum + item.total_value, 0))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Total Pago (Página):</span>
                          <span>{formatCurrency(reportData.reduce((sum, item) => sum + item.paid_amount, 0))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Saldo Total (Página):</span>
                          <span>{formatCurrency(reportData.reduce((sum, item) => sum + item.amount_balance, 0))}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            {reportData.length === 0 && !loading && (
              <div className="text-center py-10 text-gray-400">
                <p>Nenhum dado financeiro encontrado para os filtros selecionados.</p>
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

export default RelatorioFinanceiroPage;