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
import { formatCurrency, formatNumber, formatDateWithTimezone, getZonedStartOfMonth, getZonedEndOfMonth } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import CentroCustoSearchableSelect from '@/components/centros-custo/CentroCustoSearchableSelect';
import { Pagination } from '@/components/ui/pagination';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DatePicker } from '@/components/ui/date-picker';

const RelatorioFinanceiroPage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    type: 'all', // 'credito', 'debito', 'all'
    status: 'all', // 'pending', 'partially_paid', 'paid', 'overdue', 'canceled', 'all'
    clientSearchTerm: '',
    costCenter: '', // Iniciar vazio para mostrar apenas placeholder
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
      label: client.nome_fantasia ? `${client.nome_fantasia} - ${client.razao_social}` : client.razao_social,
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
          supabase.from('clientes').select('id, nome_fantasia, razao_social').order('nome_fantasia', { ascending: true }),
          supabase.from('centro_custos').select('nome').order('nome', { ascending: true }),
        ]);

        if (empresaRes.error) {
          console.error('Erro empresa:', empresaRes.error);
          toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
        } else {
          const empresaData = empresaRes.data || { items_per_page: 25, timezone: 'America/Sao_Paulo' };
          setEmpresa(empresaData);
          setFilters(prev => ({
            ...prev,
            startDate: getZonedStartOfMonth(empresaData.timezone),
            endDate: getZonedEndOfMonth(empresaData.timezone)
          }));
        }

        if (clientsRes.error) {
          console.error('Erro clientes:', clientsRes.error);
          toast({ title: 'Erro ao buscar clientes/fornecedores', variant: 'destructive' });
        } else {
          setClients(clientsRes.data || []);
        }

        if (costCentersRes.error) {
          console.error('Erro centros de custo:', costCentersRes.error);
          toast({ title: 'Erro ao buscar centros de custo', variant: 'destructive' });
        } else {
          setCostCenters(costCentersRes.data || []);
        }

      } catch (error) {
        console.error('Erro geral:', error);
        toast({ title: 'Erro ao carregar dados iniciais', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  // Função para buscar dados do sumário (totais do período)
  const fetchSummaryData = useCallback(async () => {
    if (!empresa) return;

    const startDateISO = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null;
    const endDateISO = filters.endDate ? format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;

    try {
      let query = supabase
        .from('credito_debito')
        .select('*');

      // Aplicar filtros básicos - CORREÇÃO: usando nomes em inglês
      if (startDateISO) query = query.gte('issue_date', startDateISO);
      if (endDateISO) query = query.lte('issue_date', endDateISO);
      if (filters.type !== 'all') query = query.eq('type', filters.type);
      if (filters.status !== 'all') query = query.eq('status', filters.status);

      // CORREÇÃO: Aplicar filtro de centro de custo na query principal
      if (filters.costCenter && filters.costCenter !== 'all' && filters.costCenter.trim() !== '') {
        query = query.eq('cost_center', filters.costCenter);
      }

      // Aplicar filtro de busca por cliente
      if (debouncedFilters.clientSearchTerm) {
        const searchTermLower = debouncedFilters.clientSearchTerm.toLowerCase();

        const { data: matchingClients, error: clientsError } = await supabase
          .from('clientes')
          .select('id')
          .or(`nome_fantasia.ilike.%${searchTermLower}%,razao_social.ilike.%${searchTermLower}%`);

        if (!clientsError && matchingClients && matchingClients.length > 0) {
          const matchingClientIds = matchingClients.map(client => client.id);
          query = query.in('pessoa_id', matchingClientIds);
        } else {
          query = query.or(`descricao.ilike.%${searchTermLower}%,cnpj_cpf.ilike.%${searchTermLower}%`);
        }
      }

      const { data: allFinancialData, error } = await query;

      if (error) {
        console.error('Erro na consulta do sumário:', error);
        throw error;
      }

      // Buscar informações dos clientes para o sumário
      const clientIds = [...new Set(allFinancialData?.map(item => item.pessoa_id).filter(Boolean))];
      let clientsMap = {};

      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clientes')
          .select('id, nome_fantasia, razao_social')
          .in('id', clientIds);

        if (!clientsError && clientsData) {
          clientsData.forEach(client => {
            clientsMap[client.id] = client;
          });
        }
      }

      // CORREÇÃO: Filtrar por centro de custo no frontend usando o nome correto em inglês
      let filteredData = allFinancialData || [];
      if (filters.costCenter && filters.costCenter !== 'all' && filters.costCenter.trim() !== '') {
        filteredData = filteredData.filter(item => item.cost_center === filters.costCenter);
      }

      // Calcular sumário com todos os dados do período - CORREÇÃO: usando nomes em inglês
      const summaryData = filteredData.reduce((acc, item) => {
        acc.total_entries += 1;
        acc.total_value += item.total_value || 0;
        acc.total_paid += item.paid_amount || 0;
        acc.total_balance += (item.total_value || 0) - (item.paid_amount || 0);
        return acc;
      }, { total_entries: 0, total_value: 0, total_paid: 0, total_balance: 0 });

      setSummary(summaryData);

      // Gerar dados para o gráfico (agrupamento por mês) - CORREÇÃO: usando nomes em inglês
      const monthlyData = {};
      filteredData.forEach(item => {
        if (item.issue_date) {
          const date = parseISO(item.issue_date);
          const monthKey = format(date, 'MM/yyyy');

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
              month_year: format(date, 'MMM/yyyy', { locale: ptBR }),
              total_value: 0,
              total_paid: 0,
              total_balance: 0
            };
          }

          monthlyData[monthKey].total_value += item.total_value || 0;
          monthlyData[monthKey].total_paid += item.paid_amount || 0;
          monthlyData[monthKey].total_balance += (item.total_value || 0) - (item.paid_amount || 0);
        }
      });

      setChartData(Object.values(monthlyData));

    } catch (error) {
      console.error('Erro ao buscar dados do sumário:', error);
      toast({
        title: 'Erro ao calcular totais',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [empresa, filters, debouncedFilters.clientSearchTerm, toast]);

  // Função para buscar dados financeiros para a tabela (com paginação)
  const fetchFinancialData = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const startDateISO = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null;
    const endDateISO = filters.endDate ? format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;

    try {
      let query = supabase
        .from('credito_debito')
        .select('*', { count: 'exact' });

      // Aplicar filtros básicos - CORREÇÃO: usando nomes em inglês
      if (startDateISO) query = query.gte('issue_date', startDateISO);
      if (endDateISO) query = query.lte('issue_date', endDateISO);
      if (filters.type !== 'all') query = query.eq('type', filters.type);
      if (filters.status !== 'all') query = query.eq('status', filters.status);

      // CORREÇÃO: Aplicar filtro de centro de custo na query principal
      if (filters.costCenter && filters.costCenter !== 'all' && filters.costCenter.trim() !== '') {
        query = query.eq('cost_center', filters.costCenter);
      }

      // Aplicar filtro de busca por cliente
      if (debouncedFilters.clientSearchTerm) {
        const searchTermLower = debouncedFilters.clientSearchTerm.toLowerCase();

        const { data: matchingClients, error: clientsError } = await supabase
          .from('clientes')
          .select('id')
          .or(`nome_fantasia.ilike.%${searchTermLower}%,razao_social.ilike.%${searchTermLower}%`);

        if (!clientsError && matchingClients && matchingClients.length > 0) {
          const matchingClientIds = matchingClients.map(client => client.id);
          query = query.in('pessoa_id', matchingClientIds);
        } else {
          query = query.or(`descricao.ilike.%${searchTermLower}%,cnpj_cpf.ilike.%${searchTermLower}%`);
        }
      }

      const { data: financialData, error, count } = await query
        .order('issue_date', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Erro na consulta financeira:', error);
        throw error;
      }

      // Buscar informações dos clientes separadamente
      const clientIds = [...new Set(financialData?.map(item => item.pessoa_id).filter(Boolean))];
      let clientsMap = {};

      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clientes')
          .select('id, nome_fantasia, razao_social')
          .in('id', clientIds);

        if (!clientsError && clientsData) {
          clientsData.forEach(client => {
            clientsMap[client.id] = client;
          });
        }
      }

      // Processar dados para o relatório - CORREÇÃO: usando nomes em inglês
      let processedData = (financialData || []).map(item => {
        const clienteFornecedor = clientsMap[item.pessoa_id];
        return {
          id: item.id,
          type: item.type, // CORREÇÃO: type em inglês
          document_number: item.document_number,
          model: item.modelo,
          cliente_fornecedor_name: clienteFornecedor?.razao_social || 'N/A',
          cliente_fornecedor_fantasy_name: clienteFornecedor?.nome_fantasia,
          cliente_fornecedor_razao_social: clienteFornecedor?.razao_social,
          description: item.descricao,
          issue_date: item.issue_date,
          total_value: item.total_value || 0, // CORREÇÃO: total_value em inglês
          paid_amount: item.paid_amount || 0, // CORREÇÃO: paid_amount em inglês
          amount_balance: (item.total_value || 0) - (item.paid_amount || 0), // CORREÇÃO: amount_balance em inglês
          payment_method: item.forma_pagamento,
          cost_center: item.cost_center, // CORREÇÃO: cost_center em inglês
          status: item.status,
          installment_number: item.numero_parcela || 0,
          total_installments: item.total_parcelas || 1,
          cnpj_cpf: item.cnpj_cpf
        };
      });

      // CORREÇÃO: Filtro de centro de custo já aplicado na query, não precisa filtrar novamente
      setReportData(processedData);
      setTotalCount(count || 0);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: 'Erro ao gerar relatório financeiro',
        description: error.message,
        variant: 'destructive'
      });
      setReportData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [empresa, currentPage, pageSize, filters, debouncedFilters.clientSearchTerm, toast]);

  useEffect(() => {
    if (empresa) {
      fetchSummaryData(); // Buscar totais do período
      fetchFinancialData(); // Buscar dados da tabela
    }
  }, [fetchFinancialData, fetchSummaryData, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters, pageSize]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleExportExcel = async () => {
    if (totalCount === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Filtre os dados que deseja exportar.',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar todos os dados para exportação
      let query = supabase
        .from('credito_debito')
        .select('*');

      const startDateISO = filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : null;
      const endDateISO = filters.endDate ? format(endOfDay(filters.endDate), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : null;

      // Aplicar filtros - CORREÇÃO: usando nomes em inglês
      if (startDateISO) query = query.gte('issue_date', startDateISO);
      if (endDateISO) query = query.lte('issue_date', endDateISO);
      if (filters.type !== 'all') query = query.eq('type', filters.type);
      if (filters.status !== 'all') query = query.eq('status', filters.status);

      // CORREÇÃO: Aplicar filtro de centro de custo na query principal
      if (filters.costCenter && filters.costCenter !== 'all' && filters.costCenter.trim() !== '') {
        query = query.eq('cost_center', filters.costCenter);
      }

      // Aplicar filtro de busca por cliente
      if (debouncedFilters.clientSearchTerm) {
        const searchTermLower = debouncedFilters.clientSearchTerm.toLowerCase();

        const { data: matchingClients, error: clientsError } = await supabase
          .from('clientes')
          .select('id')
          .or(`nome_fantasia.ilike.%${searchTermLower}%,razao_social.ilike.%${searchTermLower}%`);

        if (!clientsError && matchingClients && matchingClients.length > 0) {
          const matchingClientIds = matchingClients.map(client => client.id);
          query = query.in('pessoa_id', matchingClientIds);
        } else {
          query = query.or(`descricao.ilike.%${searchTermLower}%,cnpj_cpf.ilike.%${searchTermLower}%`);
        }
      }

      query = query.order('issue_date', { ascending: false });

      const { data: financialData, error } = await query;

      if (error) throw error;

      // Buscar informações dos clientes para exportação
      const clientIds = [...new Set(financialData?.map(item => item.pessoa_id).filter(Boolean))];
      let clientsMap = {};

      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clientes')
          .select('id, nome_fantasia, razao_social')
          .in('id', clientIds);

        if (!clientsError && clientsData) {
          clientsData.forEach(client => {
            clientsMap[client.id] = client;
          });
        }
      }

      // CORREÇÃO: Filtro de centro de custo já aplicado na query, não precisa filtrar novamente
      let filteredData = financialData || [];

      // Processar dados para exportação - CORREÇÃO: usando nomes em inglês
      const dataToExport = filteredData.map(item => {
        const clienteFornecedor = clientsMap[item.pessoa_id];
        const clientDisplayName = clienteFornecedor?.nome_fantasia && clienteFornecedor?.razao_social
          ? `${clienteFornecedor.nome_fantasia} - ${clienteFornecedor.razao_social}`
          : clienteFornecedor?.nome_fantasia || clienteFornecedor?.razao_social || 'N/A';

        return {
          'Tipo': item.type === 'credito' ? 'Crédito' : 'Débito', // CORREÇÃO: type em inglês
          'Nº Documento': item.document_number || 'N/A',
          'Modelo': item.modelo || 'N/A',
          'Cliente/Fornecedor': clientDisplayName,
          'CNPJ/CPF': item.cnpj_cpf || 'N/A',
          'Descrição': item.descricao,
          'Data Emissão': formatDateWithTimezone(item.issue_date, empresaTimezone),
          'Valor Total (R$)': formatNumber(item.total_value || 0), // CORREÇÃO: total_value em inglês
          'Valor Pago (R$)': formatNumber(item.paid_amount || 0), // CORREÇÃO: paid_amount em inglês
          'Saldo (R$)': formatNumber((item.total_value || 0) - (item.paid_amount || 0)), // CORREÇÃO: usando nomes em inglês
          'Forma Pagamento': item.forma_pagamento || 'N/A',
          'Centro de Custo': item.cost_center || 'N/A', // CORREÇÃO: cost_center em inglês
          'Status': getStatusText(item.status),
          'Parcela': (item.numero_parcela === 0 ? 'Entrada' : `${item.numero_parcela || 1}/${item.total_parcelas || 1}`),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioFinanceiro');
      XLSX.writeFile(workbook, 'Relatorio_Financeiro.xlsx');

      toast({
        title: 'Exportação concluída',
        description: `Relatório exportado com ${dataToExport.length} registros.`,
        variant: 'default'
      });

    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: 'Erro ao exportar dados',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
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
    if (entry.cliente_fornecedor_fantasy_name && entry.cliente_fornecedor_razao_social) {
      return `${entry.cliente_fornecedor_fantasy_name} - ${entry.cliente_fornecedor_razao_social}`;
    }
    return entry.cliente_fornecedor_fantasy_name || entry.cliente_fornecedor_razao_social || 'N/A';
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800/80 border border-gray-600 rounded-xl text-white">
          <p className="label font-bold">{`Mês: ${label}`}</p>
          <p className="text-emerald-400">{`Valor Total: ${formatCurrency(payload[0].value)}`}</p>
          <p className="text-blue-400">{`Valor Pago: ${formatCurrency(payload[1].value)}`}</p>
          <p className="text-yellow-400">{`Saldo: ${formatCurrency(payload[2].value)}`}</p>
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
            <Button
              onClick={handleExportExcel}
              disabled={totalCount === 0 || loading}
              variant="outline"
              className="flex-grow sm:flex-grow-0 rounded-xl"
            >
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
                    placeholder="Buscar por nome fantasia, razão social, descrição..."
                    value={filters.clientSearchTerm}
                    onChange={(e) => handleFilterChange('clientSearchTerm', e.target.value)}
                    className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <CentroCustoSearchableSelect
                  labelText="Centro de Custo"
                  value={filters.costCenter || ''}
                  onChange={(value) => handleFilterChange('costCenter', value || '')}
                  disabled={false}
                  allowAll={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {(loading || !empresa) && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
          </div>
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
                  <CardHeader>
                    <CardTitle className="text-emerald-300">Detalhes dos Lançamentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="responsive-table">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                            <th className="p-2 text-left text-white">Tipo</th>
                            <th className="p-2 text-left text-white">Nº Doc</th>
                            <th className="p-2 text-left text-white">Cliente/Fornecedor</th>
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
                              <TableCell data-label="Tipo" className="capitalize">
                                {item.type === 'credito' ? 'Crédito' : 'Débito'}
                              </TableCell>
                              <TableCell data-label="Nº Doc">{item.document_number || 'N/A'}</TableCell>
                              <TableCell data-label="Cliente/Fornecedor">{getClientDisplayName(item)}</TableCell>
                              <TableCell data-label="Emissão">
                                {formatDateWithTimezone(item.issue_date, empresaTimezone)}
                              </TableCell>
                              <TableCell data-label="Valor" className="text-right">
                                {formatCurrency(item.total_value)}
                              </TableCell>
                              <TableCell data-label="Pago" className="text-right">
                                {formatCurrency(item.paid_amount)}
                              </TableCell>
                              <TableCell data-label="Saldo" className="text-right font-bold">
                                {formatCurrency(item.amount_balance)}
                              </TableCell>
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
                            <TableCell colSpan={4}>Totais (Período)</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(summary.total_value)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(summary.total_paid)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(summary.total_balance)}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                      <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span>Valor Total (Período):</span>
                          <span>{formatCurrency(summary.total_value)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Total Pago (Período):</span>
                          <span>{formatCurrency(summary.total_paid)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Saldo Total (Período):</span>
                          <span>{formatCurrency(summary.total_balance)}</span>
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
        {!(loading || !empresa) && totalPages > 1 && (
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