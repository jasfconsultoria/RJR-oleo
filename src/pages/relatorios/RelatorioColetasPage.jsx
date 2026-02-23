import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, Droplets, Truck, DollarSign, Repeat, BarChart2, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useLocationData } from '@/hooks/useLocationData';
import { useProfile } from '@/contexts/ProfileContext';
import { format, subDays, endOfDay, parseISO, isValid, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { formatCurrency, formatNumber, getZonedStartOfMonth, getZonedEndOfMonth } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { UserSearchableSelect } from '@/components/ui/UserSearchableSelect';

const RelatoriosPage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [filters, setFilters] = useState({
    estado: 'all',
    municipio: 'all',
    clientSearchTerm: '',
    userId: 'all',
    tipoColeta: 'all',
    startDate: null,
    endDate: null,
  });
  const [municipios, setMunicipiosList] = useState([]);
  const { toast } = useToast();
  const { profile } = useProfile();

  // Buscar estados e municípios do banco de dados
  const { estados, fetchMunicipios } = useLocationData();
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  // ✅ NOVO: Estado para armazenar totais do período completo
  const [periodTotals, setPeriodTotals] = useState({
    totalColetas: 0,
    totalMassa: 0,
    totalPago: 0,
    totalEntregue: 0
  });

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  const municipioOptions = useMemo(() => [{ value: 'all', label: 'Todos os Municípios' }, ...municipios.map(m => ({ value: m, label: m }))], [municipios]);

  const tipoColetaOptions = [
    { value: 'all', label: 'Todos os Tipos' },
    { value: 'Compra', label: 'Compra' },
    { value: 'Troca', label: 'Troca' },
    { value: 'Doação', label: 'Doação' }
  ];

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [usuariosRes, empresaRes] = await Promise.all([
          supabase.rpc('get_all_users'),
          supabase.from('empresa').select('items_per_page, timezone').single()
        ]);

        if (usuariosRes.error) {
          toast({ title: 'Erro ao buscar usuários', variant: 'destructive' });
        } else {
          const sortedUsers = (usuariosRes.data || []).sort((a, b) => {
            if (!a.full_name) return 1;
            if (!b.full_name) return -1;
            return a.full_name.localeCompare(b.full_name);
          });
          setUsuarios(sortedUsers);
        }

        if (empresaRes.error) {
          toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
          const defaultEmpresa = { items_per_page: 25, timezone: 'America/Sao_Paulo' };
          setEmpresa(defaultEmpresa);
          if (!filters.startDate) {
            setFilters(prev => ({
              ...prev,
              startDate: format(getZonedStartOfMonth(defaultEmpresa.timezone), 'yyyy-MM-dd'),
              endDate: format(getZonedEndOfMonth(defaultEmpresa.timezone), 'yyyy-MM-dd')
            }));
          }
        } else {
          const empresaData = empresaRes.data || { items_per_page: 25, timezone: 'America/Sao_Paulo' };
          setEmpresa(empresaData);
          if (!filters.startDate) {
            setFilters(prev => ({
              ...prev,
              startDate: format(getZonedStartOfMonth(empresaData.timezone), 'yyyy-MM-dd'),
              endDate: format(getZonedEndOfMonth(empresaData.timezone), 'yyyy-MM-dd')
            }));
          }
        }

      } catch (error) {
        toast({ title: 'Erro ao carregar dados iniciais', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  // Função auxiliar para obter o nome do cliente de forma segura
  const getClientName = (item) => {
    // ✅ CORREÇÃO: Usar clientes ao invés de pessoa
    // Verificar se clientes é um array ou objeto (Supabase pode retornar ambos)
    const cliente = Array.isArray(item.clientes)
      ? (item.clientes[0] || null)
      : (item.clientes || null);

    // Mostrar "nome fantasia - razão social" quando disponível
    if (cliente?.nome_fantasia && cliente?.razao_social) {
      return `${cliente.nome_fantasia} - ${cliente.razao_social}`;
    }
    if (cliente?.nome_fantasia) {
      return cliente.nome_fantasia;
    }
    if (cliente?.razao_social) {
      return cliente.razao_social;
    }
    if (cliente?.nome) {
      return cliente.nome;
    }
    if (item.cliente_nome) {
      return item.cliente_nome;
    }
    return 'N/A';
  };

  // Função auxiliar para obter nome completo do cliente (para busca)
  const getFullClientName = (item) => {
    // ✅ CORREÇÃO: Usar clientes ao invés de pessoa
    // Verificar se clientes é um array ou objeto (Supabase pode retornar ambos)
    const cliente = Array.isArray(item.clientes)
      ? (item.clientes[0] || null)
      : (item.clientes || null);

    const names = [];
    if (cliente?.nome_fantasia) names.push(cliente.nome_fantasia);
    if (cliente?.razao_social) names.push(cliente.razao_social);
    if (cliente?.nome) names.push(cliente.nome);
    if (item.cliente_nome) names.push(item.cliente_nome);

    return names.filter(Boolean).join(' ') || '';
  };

  // Função auxiliar para obter o nome do usuário de forma segura
  const getUserName = (item) => {
    if (!item.user_id) return 'N/A';
    const usuario = usuarios.find(u => u.id === item.user_id);
    return usuario?.full_name || 'N/A';
  };

  // ✅ NOVO: Função para buscar totais do período completo
  const fetchPeriodTotals = useCallback(async (currentFilters) => {
    if (!empresa) return;

    try {
      let query = supabase
        .from('coletas')
        .select('*, clientes:cliente_id(*)');

      // Aplicar os mesmos filtros da consulta principal
      if (currentFilters.estado && currentFilters.estado !== 'all') query = query.eq('estado', currentFilters.estado);
      if (currentFilters.municipio && currentFilters.municipio !== 'all') query = query.eq('municipio', currentFilters.municipio);
      if (currentFilters.userId && currentFilters.userId !== 'all') query = query.eq('user_id', currentFilters.userId);
      if (currentFilters.tipoColeta && currentFilters.tipoColeta !== 'all') query = query.eq('tipo_coleta', currentFilters.tipoColeta);
      if (currentFilters.startDate) query = query.gte('data_coleta', currentFilters.startDate);
      if (currentFilters.endDate) {
        const endOfDayDate = format(endOfDay(parseISO(currentFilters.endDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
        query = query.lte('data_coleta', endOfDayDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Erro ao buscar totais do período:", error);
        setPeriodTotals({ totalColetas: 0, totalMassa: 0, totalPago: 0, totalEntregue: 0 });
        return;
      }

      let filteredData = data || [];

      // ✅ CORREÇÃO: Filtro por cliente no lado do cliente (client-side)
      if (currentFilters.clientSearchTerm) {
        const searchTermLower = currentFilters.clientSearchTerm.toLowerCase();
        filteredData = filteredData.filter(item => {
          const fullClientName = getFullClientName(item).toLowerCase();
          return fullClientName.includes(searchTermLower);
        });
      }

      // Calcular totais do período completo
      const totals = filteredData.reduce((acc, item) => {
        acc.totalColetas += 1;
        acc.totalMassa += Number(item.quantidade_coletada) || 0;
        if (item.tipo_coleta === 'Compra') {
          acc.totalPago += Number(item.total_pago) || 0;
        }
        if (item.tipo_coleta === 'Troca' || item.tipo_coleta === 'Doação') {
          acc.totalEntregue += Number(item.quantidade_entregue) || 0;
        }
        return acc;
      }, { totalColetas: 0, totalMassa: 0, totalPago: 0, totalEntregue: 0 });

      console.log('📊 Totais do período completo:', totals);
      setPeriodTotals(totals);
    } catch (error) {
      console.error("❌ Erro inesperado ao buscar totais do período:", error);
      setPeriodTotals({ totalColetas: 0, totalMassa: 0, totalPago: 0, totalEntregue: 0 });
    }
  }, [empresa]);

  const fetchReportData = useCallback(async (currentFilters) => {
    if (!empresa) return;
    setLoading(true);

    try {
      // ✅ CORREÇÃO: Buscar TODOS os dados que correspondem aos filtros do servidor primeiro
      // (sem paginação) para poder aplicar o filtro de cliente corretamente
      let query = supabase
        .from('coletas')
        .select('*, clientes:cliente_id(*)');

      // Filtros do servidor
      if (currentFilters.estado && currentFilters.estado !== 'all') query = query.eq('estado', currentFilters.estado);
      if (currentFilters.municipio && currentFilters.municipio !== 'all') query = query.eq('municipio', currentFilters.municipio);
      if (currentFilters.userId && currentFilters.userId !== 'all') query = query.eq('user_id', currentFilters.userId);
      if (currentFilters.tipoColeta && currentFilters.tipoColeta !== 'all') query = query.eq('tipo_coleta', currentFilters.tipoColeta);
      if (currentFilters.startDate) query = query.gte('data_coleta', currentFilters.startDate);
      if (currentFilters.endDate) {
        const endOfDayDate = format(endOfDay(parseISO(currentFilters.endDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
        query = query.lte('data_coleta', endOfDayDate);
      }

      query = query.order('data_coleta', { ascending: false });

      const { data, error } = await query;

      if (error) {
        toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
        setReportData([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      let filteredData = data || [];

      // ✅ CORREÇÃO: Aplicar filtro por cliente ANTES da paginação
      if (currentFilters.clientSearchTerm) {
        const searchTermLower = currentFilters.clientSearchTerm.toLowerCase();
        filteredData = filteredData.filter(item => {
          const fullClientName = getFullClientName(item).toLowerCase();
          return fullClientName.includes(searchTermLower);
        });
      }

      // ✅ CORREÇÃO: Contar o número real de registros após aplicar todos os filtros
      const realCount = filteredData.length;
      setTotalCount(realCount);

      // ✅ CORREÇÃO: Aplicar paginação no client-side APÓS filtrar
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize;
      const paginatedData = filteredData.slice(from, to);

      setReportData(paginatedData);
    } catch (error) {
      console.error("❌ Erro inesperado ao buscar dados do relatório:", error);
      toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
      setReportData([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [toast, currentPage, pageSize, empresa]);

  // ✅ NOVO: Buscar totais do período quando os filtros mudarem
  useEffect(() => {
    if (empresa) {
      fetchPeriodTotals(debouncedFilters);
    }
  }, [debouncedFilters, fetchPeriodTotals, empresa]);

  useEffect(() => {
    if (empresa) {
      fetchReportData(debouncedFilters);
    }
  }, [debouncedFilters, fetchReportData, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters, pageSize]);

  useEffect(() => {
    const loadMunicipios = async () => {
      if (profile?.role === 'coletor' && profile.estado) {
        setFilters(prev => ({ ...prev, estado: profile.estado }));
        const municipiosList = await fetchMunicipios(profile.estado);
        setMunicipiosList(municipiosList);
      }
    };
    loadMunicipios();
  }, [profile, fetchMunicipios]);

  useEffect(() => {
    const loadMunicipios = async () => {
      if (filters.estado && filters.estado !== 'all') {
        const municipiosList = await fetchMunicipios(filters.estado);
        setMunicipiosList(municipiosList);
      } else {
        setMunicipiosList([]);
        setFilters(prev => ({ ...prev, municipio: 'all' }));
      }
    };
    loadMunicipios();
  }, [filters.estado, fetchMunicipios]);

  const handleExportExcel = async () => {
    if (totalCount === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    setLoading(true);
    let allData = [];
    const totalPagesToFetch = Math.ceil(totalCount / 500);

    for (let i = 0; i < totalPagesToFetch; i++) {
      const from = i * 500;
      const to = from + 500 - 1;

      let query = supabase
        .from('coletas')
        .select('*, clientes:cliente_id(*)');

      // Aplicar os mesmos filtros da consulta principal
      if (filters.estado && filters.estado !== 'all') query = query.eq('estado', filters.estado);
      if (filters.municipio && filters.municipio !== 'all') query = query.eq('municipio', filters.municipio);
      if (filters.userId && filters.userId !== 'all') query = query.eq('user_id', filters.userId);
      if (filters.tipoColeta && filters.tipoColeta !== 'all') query = query.eq('tipo_coleta', filters.tipoColeta);
      if (filters.startDate) query = query.gte('data_coleta', filters.startDate);
      if (filters.endDate) {
        const endOfDayDate = format(endOfDay(parseISO(filters.endDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
        query = query.lte('data_coleta', endOfDayDate);
      }

      query = query.order('data_coleta', { ascending: false }).range(from, to);

      const { data, error } = await query;
      if (error) {
        toast({ title: 'Erro ao exportar dados', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Aplicar filtro de cliente no client-side também para a exportação
      let filteredData = data || [];
      if (filters.clientSearchTerm) {
        const searchTermLower = filters.clientSearchTerm.toLowerCase();
        filteredData = filteredData.filter(item => {
          const fullClientName = getFullClientName(item).toLowerCase();
          return fullClientName.includes(searchTermLower);
        });
      }

      allData = [...allData, ...filteredData];
    }
    setLoading(false);

    const dataToExport = allData.map(item => {
      const dateObj = parseISO(item.data_coleta);
      const formattedDate = isValid(dateObj) ? format(dateObj, 'dd/MM/yyyy', { locale: ptBR }) : 'N/A';
      const clientDisplayName = getClientName(item);
      const userName = getUserName(item);

      return {
        'Data Coleta': formattedDate,
        'Cliente': clientDisplayName,
        'Usuário': userName,
        'Estado': item.estado,
        'Município': item.municipio,
        'Tipo Coleta': item.tipo_coleta,
        'Qtd Coletada (kg)': formatNumber(item.quantidade_coletada),
        'Qtd Entregue (Unidades)': (item.tipo_coleta === 'Troca' || item.tipo_coleta === 'Doação') ? formatNumber(item.quantidade_entregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : 'N/A',
        'Total Pago (R$)': item.tipo_coleta === 'Compra' ? formatCurrency(item.total_pago) : 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioColetas');
    XLSX.writeFile(workbook, 'Relatorio_Coletas.xlsx');
  };

  // ✅ CORREÇÃO: Remover cálculo dos totais da página (não é mais necessário)
  // Os totais agora vêm do periodTotals

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet><title>Relatórios - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-8 h-8 text-emerald-400" /> Relatórios de Coletas
            </h1>
            <p className="text-emerald-200/80 mt-1">Filtre e analise os dados das coletas realizadas.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleExportExcel} disabled={totalCount === 0 || loading} variant="outline" className="flex-grow sm:flex-grow-0 rounded-xl">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} Exportar
            </Button>
          </div>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl relative z-20">
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="startDate">Data Início</Label>
                <Input id="startDate" type="date" value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} className="bg-white/10 border-white/30 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="endDate">Data Fim</Label>
                <Input id="endDate" type="date" value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} className="bg-white/10 border-white/30 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select value={filters.estado} onValueChange={(value) => setFilters({ ...filters, estado: value || 'all' })} disabled={profile?.role === 'coletor'}>
                  <SelectTrigger id="estado" className="w-full bg-white/10 border-white/20 text-white focus:ring-emerald-400 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl max-h-60 overflow-y-auto"><SelectItem value="all">Todos os Estados</SelectItem>{estados.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="municipio">Município</Label>
                <SearchableSelect
                  options={municipioOptions}
                  value={filters.municipio}
                  onChange={(value) => setFilters({ ...filters, municipio: value || 'all' })}
                  placeholder="Todos os Municípios"
                  disabled={!filters.estado || filters.estado === 'all'}
                />
              </div>
              <div className="relative z-30">
                <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                  <Input
                    id="clientSearch"
                    type="search"
                    placeholder="Buscar por nome do cliente..."
                    value={filters.clientSearchTerm}
                    onChange={(e) => setFilters(f => ({ ...f, clientSearchTerm: e.target.value }))}
                    className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                  />
                </div>
              </div>
              <div className="relative z-20">
                <UserSearchableSelect
                  labelText="Usuário"
                  value={filters.userId}
                  onChange={(value) => setFilters({ ...filters, userId: value || 'all' })}
                  users={usuarios}
                  loading={loading}
                />
              </div>
              <div>
                <Label htmlFor="tipoColeta">Tipo de Coleta</Label>
                <Select value={filters.tipoColeta} onValueChange={(value) => setFilters({ ...filters, tipoColeta: value || 'all' })}>
                  <SelectTrigger id="tipoColeta" className="w-full bg-white/10 border-white/20 text-white focus:ring-emerald-400 rounded-xl">
                    <SelectValue placeholder="Todos os Tipos" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                    {tipoColetaOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
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
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total de Coletas</CardTitle><Truck className="h-4 w-4 text-gray-400" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{periodTotals.totalColetas}</div></CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Massa Total Coletada</CardTitle><Droplets className="h-4 w-4 text-gray-400" /></CardHeader>
                    <CardContent><div className="2xl font-bold">{formatNumber(periodTotals.totalMassa)} kg</div></CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total Pago (Compras)</CardTitle><DollarSign className="h-4 w-4 text-gray-400" /></CardHeader>
                    <CardContent><div className="2xl font-bold">{formatCurrency(periodTotals.totalPago)}</div></CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total Entregue (Trocas/Doações)</CardTitle><Repeat className="h-4 w-4 text-gray-400" /></CardHeader>
                    <CardContent><div className="2xl font-bold">{formatNumber(periodTotals.totalEntregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades</div></CardContent>
                  </Card>
                </div>

                <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                  <CardHeader><CardTitle className="text-emerald-300">Dados do Relatório</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="responsive-table">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                            <th className="p-2 text-left text-white">Data</th>
                            <th className="p-2 text-left text-white">Cliente</th>
                            <th className="p-2 text-left text-white">Usuário</th>
                            <th className="p-2 text-left text-white">Local</th>
                            <th className="p-2 text-left text-white">Tipo</th>
                            <th className="p-2 text-right text-white">Qtd. (kg)</th>
                            <th className="p-2 text-right text-white">Valor/Entregue</th>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map(item => {
                            const dateObj = parseISO(item.data_coleta);
                            const formattedDate = isValid(dateObj) ? format(dateObj, 'dd/MM/yyyy', { locale: ptBR }) : 'N/A';
                            const clientDisplayName = getClientName(item);

                            return (
                              <TableRow key={item.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                                <TableCell data-label="Data">{formattedDate}</TableCell>
                                <TableCell data-label="Cliente">{clientDisplayName}</TableCell>
                                <TableCell data-label="Usuário">{getUserName(item)}</TableCell>
                                <TableCell data-label="Local">{item.municipio}, {item.estado}</TableCell>
                                <TableCell data-label="Tipo">{item.tipo_coleta}</TableCell>
                                <TableCell data-label="Qtd. (kg)" className="text-right">{formatNumber(item.quantidade_coletada)}</TableCell>
                                <TableCell data-label="Valor/Entregue" className="text-right">{(item.tipo_coleta === 'Troca' || item.tipo_coleta === 'Doação') ? `${formatNumber(item.quantidade_entregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades` : formatCurrency(item.total_pago)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="hover:bg-transparent border-t-2 border-emerald-500 font-bold hidden md:table-row">
                            <TableCell colSpan={5}>Totais (Período)</TableCell>
                            <TableCell className="text-right">{formatNumber(periodTotals.totalMassa)} kg</TableCell>
                            <TableCell className="text-right">{`${formatCurrency(periodTotals.totalPago)} / ${formatNumber(periodTotals.totalEntregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades`}</TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                      <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span>Total Massa (Período):</span>
                          <span>{formatNumber(periodTotals.totalMassa)} kg</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Total Pago/Entregue (Período):</span>
                          <span>{`${formatCurrency(periodTotals.totalPago)} / ${formatNumber(periodTotals.totalEntregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades`}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            {reportData.length === 0 && !loading && (
              <div className="text-center py-10 text-gray-400">
                <p>Nenhum dado encontrado para os filtros selecionados.</p>
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

export default RelatoriosPage;