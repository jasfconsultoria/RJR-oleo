import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, Box, Calendar, MapPin, Search, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useProfile } from '@/contexts/ProfileContext';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { formatNumber } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';

const RelatorioRecipientesPage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    estado: 'todos',
    municipio: 'todos',
    searchTerm: '',
    apenasInativos: false,
    apenasAtivos: false,
    diasInatividade: 30,
  });

  const [availableStates, setAvailableStates] = useState([]);
  const [availableMunicipios, setAvailableMunicipios] = useState([]);
  const { toast } = useToast();
  const { profile } = useProfile();
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalGlobal, setTotalGlobal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const fetchFiltersData = useCallback(async () => {
    try {
      // Buscar estados únicos
      const { data: statesData, error: statesError } = await supabase
        .from('clientes')
        .select('estado')
        .not('estado', 'is', null)
        .order('estado');
      
      if (statesError) throw statesError;
      const uniqueStates = [...new Set(statesData.map(c => c.estado))].sort();
      setAvailableStates(uniqueStates);

      // Buscar municípios únicos (respeitando o estado se selecionado)
      let query = supabase
        .from('clientes')
        .select('municipio')
        .not('municipio', 'is', null);
      
      if (filters.estado !== 'todos') {
        query = query.eq('estado', filters.estado);
      }

      const { data: munData, error: munError } = await query.order('municipio');
      if (munError) throw munError;
      
      const uniqueMuns = [...new Set(munData.map(c => c.municipio))].sort();
      setAvailableMunicipios(uniqueMuns.map(m => ({ value: m, label: m })));

    } catch (error) {
      console.error("Erro ao carregar dados dos filtros:", error);
    }
  }, [filters.estado]);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  const fetchCompanySettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) throw error;
      if (data?.items_per_page) setItemsPerPage(data.items_per_page);
    } catch (error) {
      console.error("Erro ao buscar configurações da empresa:", error);
    }
  }, []);

  const fetchTotalGlobal = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('clientes').select('recipientes_saldo');
      if (error) throw error;
      const total = data.reduce((acc, c) => acc + (c.recipientes_saldo || 0), 0);
      setTotalGlobal(total);
    } catch (error) {
      console.error("Erro ao buscar total global de recipientes:", error);
    }
  }, []);

  useEffect(() => {
    fetchCompanySettings();
    fetchTotalGlobal();
  }, [fetchCompanySettings, fetchTotalGlobal]);

  const municipioOptions = useMemo(() => [
    { value: 'todos', label: `Município: Todos (${availableMunicipios.length})` },
    ...availableMunicipios
  ], [availableMunicipios]);

  const [totalFiltrado, setTotalFiltrado] = useState(0);
  const [totalInativosCount, setTotalInativosCount] = useState(0);

  const fetchReportData = useCallback(async (currentFilters) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_recipientes_detailed_report', {
        p_estado: currentFilters.estado === 'todos' ? 'all' : currentFilters.estado,
        p_municipio: currentFilters.municipio === 'todos' ? 'all' : currentFilters.municipio,
        p_search_term: currentFilters.searchTerm,
        p_apenas_inativos: currentFilters.apenasInativos,
        p_apenas_ativos: currentFilters.apenasAtivos,
        p_dias_inatividade: parseInt(currentFilters.diasInatividade) || 0
      });

      if (error) throw error;

      setTotalCount(data.length);
      const totalSum = data.reduce((acc, item) => acc + (item.res_recipientes_saldo || 0), 0);
      setTotalFiltrado(totalSum);

      const inativos = data.filter(item => item.res_dias_sem_coleta >= currentFilters.diasInatividade).length;
      setTotalInativosCount(inativos);
      
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage;
      setReportData(data.slice(from, to));
      
    } catch (error) {
      console.error("Erro ao buscar dados do relatório:", error);
      toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [toast, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchReportData(debouncedFilters);
  }, [debouncedFilters, fetchReportData]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters]);

  const stats = useMemo(() => {
    const totalRecipientesFiltrados = reportData.reduce((acc, item) => acc + (item.res_recipientes_saldo || 0), 0);
    const inativosCount = reportData.filter(item => item.res_dias_sem_coleta >= filters.diasInatividade).length;
    
    return { totalRecipientesFiltrados, inativosCount };
  }, [reportData, filters.diasInatividade]);

  const handleExportExcel = () => {
    if (reportData.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const dataToExport = reportData.map(item => ({
      'Cliente': item.res_nome_fantasia || item.res_razao_social,
      'Cidade': item.res_municipio,
      'UF': item.res_estado,
      'Saldo Atual': item.res_recipientes_saldo,
      'Última Coleta': item.res_data_ultima_coleta ? format(parseISO(item.res_data_ultima_coleta), 'dd/MM/yyyy') : 'Nunca',
      'Dias Inativo': item.res_dias_sem_coleta === 9999 ? 'Nunca Coletado' : item.res_dias_sem_coleta
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioRecipientes');
    XLSX.writeFile(workbook, `Relatorio_Recipientes_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <>
      <Helmet><title>Relatório de Recipientes - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <Box className="w-8 h-8 text-yellow-400" /> Relatório de Recipientes
            </h1>
            <p className="text-emerald-200/80 mt-1">Controle de ativos e inatividade de clientes.</p>
          </div>
          <Button onClick={handleExportExcel} disabled={loading || reportData.length === 0} variant="outline" className="rounded-xl">
            <FileDown className="mr-2 h-4 w-4" /> Exportar Excel
          </Button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 shadow-xl border border-white/5 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
              <Input 
                placeholder="Buscar por nome fantasia, razão social, CNPJ/CPF, município ou estado do cliente..." 
                className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                value={filters.searchTerm}
                onChange={e => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2 relative">
              <select
                className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                value={filters.estado}
                onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}
              >
                <option value="todos" className="bg-slate-900">Estado: Todos ({availableStates.length})</option>
                {availableStates.map(e => <option key={e} value={e} className="bg-slate-900">{e}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            </div>

            <div className="md:col-span-3 relative">
              <SearchableSelect
                options={municipioOptions}
                value={filters.municipio}
                onChange={val => setFilters(f => ({ ...f, municipio: val }))}
                placeholder={`Município: Todos (${availableMunicipios.length})`}
                className="h-11 bg-white/10 border-white/20 rounded-xl"
              />
            </div>


            <div className="md:col-span-1 relative">
              <div className="flex items-center space-x-2">
                <Input 
                  type="number" 
                  title="Dias de Inatividade"
                  className="h-11 bg-white/10 border-white/20 rounded-xl text-center w-20"
                  value={filters.diasInatividade}
                  onChange={e => setFilters(f => ({ ...f, diasInatividade: e.target.value }))}
                />
                <span className="text-emerald-200 text-sm">Dias</span>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col justify-center space-y-1">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ativos" 
                  checked={filters.apenasAtivos} 
                  onCheckedChange={checked => setFilters(f => ({ ...f, apenasAtivos: checked, apenasInativos: checked ? false : f.apenasInativos }))}
                  className="w-5 h-5 border-white/30 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none"
                />
                <Label htmlFor="ativos" className="cursor-pointer text-sm text-emerald-200">Apenas Ativos</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="inativos" 
                  checked={filters.apenasInativos} 
                  onCheckedChange={checked => setFilters(f => ({ ...f, apenasInativos: checked, apenasAtivos: checked ? false : f.apenasAtivos }))}
                  className="w-5 h-5 border-white/30 data-[state=checked]:bg-red-500 data-[state=checked]:border-none"
                />
                <Label htmlFor="inativos" className="cursor-pointer text-sm text-red-200">Apenas Inativos</Label>
              </div>
            </div>
          </div>
        </div>


        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total de Recipientes</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-white">{totalGlobal.toLocaleString('pt-BR')}</div></CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Recipientes em Campo</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-400">{totalFiltrado.toLocaleString('pt-BR')}</div></CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Clientes Atendidos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalCount}</div></CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-red-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Inativos ({filters.diasInatividade}d+)</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-400">{totalInativosCount}</div></CardContent>
          </Card>
        </div>


        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableCell className="font-semibold">Cliente</TableCell>
                    <TableCell className="font-semibold">Localidade</TableCell>
                    <TableCell className="font-semibold text-center">Saldo</TableCell>
                    <TableCell className="font-semibold">Última Coleta</TableCell>
                    <TableCell className="font-semibold">Status de Atividade</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" /></TableCell></TableRow>
                  ) : reportData.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-gray-400">Nenhum cliente encontrado com os filtros.</TableCell></TableRow>
                  ) : (
                    reportData.map((item) => (
                      <TableRow key={item.res_cliente_id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell data-label="Cliente" className="font-medium">
                          {item.res_nome_fantasia && item.res_razao_social
                            ? `${item.res_nome_fantasia} - ${item.res_razao_social}`
                            : item.res_nome_fantasia || item.res_razao_social || 'Nome não informado'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-emerald-400" />
                            {item.res_municipio}, {item.res_estado}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-bold text-yellow-400">
                          {item.res_recipientes_saldo}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-3 w-3 text-emerald-400" />
                            {item.res_data_ultima_coleta ? format(parseISO(item.res_data_ultima_coleta), 'dd/MM/yyyy') : 'Nunca'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.res_dias_sem_coleta >= filters.diasInatividade ? (
                            <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              {item.res_dias_sem_coleta === 9999 ? 'Sem Coletas' : `${item.res_dias_sem_coleta} dias parado`}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                              <CheckCircle2 className="h-4 w-4" />
                              Ativo ({item.res_dias_sem_coleta}d)
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={itemsPerPage}
          totalCount={totalCount}
        />
      </div>
    </>
  );
};

export default RelatorioRecipientesPage;
