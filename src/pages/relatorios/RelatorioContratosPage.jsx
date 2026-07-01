import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, FileText, FileSignature, Calendar, MapPin, Search, AlertTriangle, CheckCircle2, ChevronDown, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { format, parseISO, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Pagination } from '@/components/ui/pagination';
import { formatCnpjCpf, matchesClienteSearch } from '@/lib/utils';
import { generateReportPdf, printPdfBlobUrl } from '@/lib/reportPdf';

const RelatorioContratosPage = () => {
  const [reportData, setReportData] = useState([]);
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    estado: 'todos',
    municipio: 'todos',
    searchTerm: '',
    statusVencimento: 'todos',
    statusContrato: 'todos',
  });

  const [availableStates, setAvailableStates] = useState([]);
  const [availableMunicipios, setAvailableMunicipios] = useState([]);
  const { toast } = useToast();
  const debouncedFilters = useDebounce(filters, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [municipioMap, setMunicipioMap] = useState({});
  const [empresa, setEmpresa] = useState(null);

  const fetchFiltersData = useCallback(async () => {
    try {
      const { data: statesData, error: statesError } = await supabase
        .from('clientes')
        .select('estado')
        .not('estado', 'is', null)
        .order('estado');
      
      if (statesError) throw statesError;
      const uniqueStates = [...new Set(statesData.map(c => c.estado))].sort();
      setAvailableStates(uniqueStates);

      let query = supabase
        .from('clientes')
        .select('municipio')
        .not('municipio', 'is', null);
      
      if (filters.estado !== 'todos') {
        query = query.eq('estado', filters.estado);
      }

      const { data: munData, error: munError } = await query.order('municipio');
      if (munError) throw munError;
      
      const uniqueMuns = [...new Set(munData.map(c => c.municipio))].filter(Boolean).sort();
      
      const codesToFetch = uniqueMuns.filter(m => /^\d+$/.test(m));
      let resolvedMap = {};
      
      if (codesToFetch.length > 0) {
        try {
          const { data: ibgeData } = await supabase
            .from('municipios')
            .select('codigo, municipio')
            .in('codigo', codesToFetch);
          if (ibgeData) {
            ibgeData.forEach(item => {
              resolvedMap[item.codigo.toString()] = item.municipio;
            });
          }
        } catch (e) {
          console.error("Erro ao resolver IBGE:", e);
        }
      }
      
      setMunicipioMap(resolvedMap);

      setAvailableMunicipios(uniqueMuns.map(m => ({ 
        value: m, 
        label: resolvedMap[m] || m 
      })));

    } catch (error) {
      console.error("Erro ao carregar dados dos filtros:", error);
    }
  }, [filters.estado]);

  useEffect(() => {
    fetchFiltersData();
  }, [fetchFiltersData]);

  const fetchCompanySettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('empresa').select('*').single();
      if (error) throw error;
      if (data?.items_per_page) setItemsPerPage(data.items_per_page);
      setEmpresa(data);
    } catch (error) {
      console.error("Erro ao buscar configurações da empresa:", error);
    }
  }, []);

  useEffect(() => {
    fetchCompanySettings();
  }, [fetchCompanySettings]);

  const municipioOptions = useMemo(() => [
    { value: 'todos', label: `Município: Todos (${availableMunicipios.length})` },
    ...availableMunicipios
  ], [availableMunicipios]);

  const availableStatus = useMemo(() => {
    return [...new Set(allData.map(c => c.status))].filter(Boolean).sort();
  }, [allData]);

  const getFilteredContratos = useCallback((sourceData = allData) => {
    let filtered = sourceData;

    if (debouncedFilters.searchTerm) {
      const termo = debouncedFilters.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.numero_contrato?.toLowerCase().includes(termo) ||
        matchesClienteSearch(item.pessoa, debouncedFilters.searchTerm)
      );
    }

    if (debouncedFilters.estado !== 'todos') {
      filtered = filtered.filter(item => item.pessoa?.estado === debouncedFilters.estado);
    }

    if (debouncedFilters.municipio !== 'todos') {
      filtered = filtered.filter(item => item.pessoa?.municipio === debouncedFilters.municipio);
    }

    if (debouncedFilters.statusVencimento === 'vencidos') {
      filtered = filtered.filter(item => item.dias_vencimento !== null && item.dias_vencimento < 0);
    } else if (debouncedFilters.statusVencimento === 'vencendo_hoje') {
      filtered = filtered.filter(item => item.dias_vencimento === 0);
    } else if (debouncedFilters.statusVencimento.startsWith('a_vencer_')) {
      const diasLimites = parseInt(debouncedFilters.statusVencimento.split('_')[2], 10);
      filtered = filtered.filter(item => item.dias_vencimento !== null && item.dias_vencimento > 0 && item.dias_vencimento <= diasLimites);
    } else if (debouncedFilters.statusVencimento === 'indeterminado') {
      filtered = filtered.filter(item => item.dias_vencimento === null);
    }

    if (debouncedFilters.statusContrato !== 'todos') {
      filtered = filtered.filter(item => item.status === debouncedFilters.statusContrato);
    }

    return filtered;
  }, [allData, debouncedFilters]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          pessoa:clientes(
            razao_social, 
            nome_fantasia, 
            estado, 
            municipio,
            cnpj_cpf
          )
        `)
        .order('data_fim', { ascending: true }); // Mais antigos primeiro (vencidos primeiro)

      if (error) throw error;

      // O processamento das regras, dias etc. é melhor ser feito antes do filtro de UI
      const today = new Date(new Date().setHours(0,0,0,0));
      
      const processedData = data.map(item => {
        let diffDays = null;
        if (item.data_fim) {
            const endDate = parseISO(item.data_fim);
            diffDays = isNaN(endDate) ? null : differenceInDays(endDate, today);
        }
        return {
          ...item,
          dias_vencimento: diffDays
        };
      });

      setAllData(processedData);
      
    } catch (error) {
      console.error("Erro ao buscar dados do relatório de contratos:", error);
      toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
      setAllData([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Aplicar Filtros no front-end
  useEffect(() => {
    const filtered = getFilteredContratos();

    setTotalCount(filtered.length);
    
    // Paginação
    const from = (currentPage - 1) * itemsPerPage;
    const to = from + itemsPerPage;
    setReportData(filtered.slice(from, to));

  }, [getFilteredContratos, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters]);

  const metrics = useMemo(() => {
    const total = allData.length;
    // Vigentes agora só contabiliza os que não estouraram o prazo e constam estritamente como Ativo
    const vigentes = allData.filter(item => (item.dias_vencimento === null || item.dias_vencimento >= 0) && item.status === 'Ativo').length;
    // Vencidos mesmo se estiver Ativo, a data prevalece.
    const vencidos = allData.filter(item => item.dias_vencimento !== null && item.dias_vencimento < 0).length;
    const aguardando = allData.filter(item => item.status === 'Aguardando Assinatura').length;
    
    return { total, vigentes, vencidos, aguardando };
  }, [allData]);

  const formatContractDate = (value) => {
    if (!value) return 'N/A';
    const date = parseISO(value);
    return isNaN(date) ? 'N/A' : format(date, 'dd/MM/yyyy');
  };

  const getVencimentoText = (item) => {
    if (item.dias_vencimento === null) return 'Indeterminado';
    if (item.dias_vencimento < 0) return `Vencido há ${Math.abs(item.dias_vencimento)} dias`;
    if (item.dias_vencimento === 0) return 'Vence hoje';
    return `Vence em ${item.dias_vencimento} dias`;
  };

  const getStatusVencimentoLabel = (value) => {
    const labels = {
      todos: 'Todos',
      vencidos: 'Vencidos',
      vencendo_hoje: 'Vence Hoje',
      a_vencer_15: 'Vence em até 15 Dias',
      a_vencer_30: 'Vence em até 30 Dias',
      a_vencer_60: 'Vence em até 60 Dias',
      a_vencer_90: 'Vence em até 90 Dias',
      indeterminado: 'Prazo Indeterminado',
    };
    return labels[value] || value;
  };

  const buildContratoExportRows = (data) => data.map(item => ({
    'Nº Contrato': item.numero_contrato,
    'Cliente': item.pessoa?.nome_fantasia || item.pessoa?.razao_social || 'N/A',
    'Cidade': municipioMap[item.pessoa?.municipio] || item.pessoa?.municipio || 'N/A',
    'UF': item.pessoa?.estado || 'N/A',
    'Data Início': formatContractDate(item.data_inicio),
    'Data Fim': formatContractDate(item.data_fim),
    'Status': item.status,
    'Situação (Vencimento)': getVencimentoText(item)
  }));

  const buildContratoSubtotals = (data, key, labelGetter) => {
    const subtotals = data.reduce((acc, item) => {
      const rawValue = typeof key === 'function' ? key(item) : item[key];
      const label = labelGetter ? labelGetter(rawValue) : rawValue;
      const safeLabel = label || 'Não informado';
      acc[safeLabel] = (acc[safeLabel] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(subtotals)
      .map(([label, quantidade]) => ({ label, quantidade }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const handleExportExcel = () => {
    const filteredData = getFilteredContratos();
    if (filteredData.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const dataToExport = buildContratoExportRows(filteredData);

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contratos');
    XLSX.writeFile(workbook, `Relatorio_Contratos_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleExportPdf = async () => {
    const filteredData = getFilteredContratos();
    if (filteredData.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const totalVigentes = filteredData.filter(item => (item.dias_vencimento === null || item.dias_vencimento >= 0) && item.status === 'Ativo').length;
      const totalVencidos = filteredData.filter(item => item.dias_vencimento !== null && item.dias_vencimento < 0).length;
      const totalAguardando = filteredData.filter(item => item.status === 'Aguardando Assinatura').length;
      const pdfUrl = await generateReportPdf({
        title: 'Relatório de Contratos',
        subtitle: 'Análise de contratos vencidos, vigentes e a vencer.',
        fileName: `Relatorio_Contratos_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`,
        company: empresa,
        filters: [
          { label: 'Estado', value: filters.estado === 'todos' ? 'Todos' : filters.estado },
          { label: 'Município', value: filters.municipio === 'todos' ? 'Todos' : municipioMap[filters.municipio] || filters.municipio },
          { label: 'Busca', value: filters.searchTerm || 'Todos' },
          { label: 'Status', value: filters.statusContrato === 'todos' ? 'Todos' : filters.statusContrato },
          { label: 'Prazo', value: getStatusVencimentoLabel(filters.statusVencimento) },
        ],
        summaryItems: [
          { label: 'Total de Contratos', value: filteredData.length },
          { label: 'Contratos Vigentes', value: totalVigentes },
          { label: 'Contratos Vencidos', value: totalVencidos },
          { label: 'Ag. Assinatura', value: totalAguardando },
        ],
        subtotalTables: [
          {
            title: 'Subtotais por Status do Contrato',
            columns: [
              { header: 'Status', accessor: 'label', width: 65 },
              { header: 'Contratos', accessor: 'quantidade', width: 32, align: 'right' },
            ],
            rows: buildContratoSubtotals(filteredData, 'status'),
          },
          {
            title: 'Subtotais por Situação de Vencimento',
            columns: [
              { header: 'Situação', accessor: 'label', width: 75 },
              { header: 'Contratos', accessor: 'quantidade', width: 32, align: 'right' },
            ],
            rows: buildContratoSubtotals(filteredData, getVencimentoText),
          },
        ],
        columns: [
          { header: 'Nº Contrato', accessor: 'numero', width: 28 },
          { header: 'Cliente', accessor: 'cliente', width: 68 },
          { header: 'Localidade', accessor: 'localidade', width: 38 },
          { header: 'Início', accessor: 'inicio', width: 22 },
          { header: 'Fim', accessor: 'fim', width: 22 },
          { header: 'Status', accessor: 'status', width: 34 },
          { header: 'Vencimento', accessor: 'vencimento', width: 42 },
        ],
        rows: filteredData.map(item => ({
          numero: item.numero_contrato || 'N/A',
          cliente: item.pessoa?.nome_fantasia || item.pessoa?.razao_social || 'Cliente não encontrado',
          localidade: item.pessoa ? `${municipioMap[item.pessoa.municipio] || item.pessoa.municipio || 'N/A'}, ${item.pessoa.estado || 'N/A'}` : 'N/A',
          inicio: formatContractDate(item.data_inicio),
          fim: formatContractDate(item.data_fim),
          status: item.status || 'N/A',
          vencimento: getVencimentoText(item),
        })),
        output: 'bloburl',
      });

      printPdfBlobUrl(pdfUrl);
      toast({
        title: 'PDF enviado para impressão',
        description: `Relatório gerado com ${filteredData.length} registros.`,
        variant: 'default'
      });
    } catch (error) {
      toast({ title: 'Erro ao gerar PDF', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <>
      <Helmet><title>Relatório de Contratos - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <FileSignature className="w-8 h-8 text-yellow-400" /> Relatório de Contratos
            </h1>
            <p className="text-emerald-200/80 mt-1">Análise de contratos vencidos e a vencer.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleExportExcel} disabled={loading || totalCount === 0} variant="outline" className="flex-grow sm:flex-grow-0 rounded-xl">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} Exportar Excel
            </Button>
            <Button onClick={handleExportPdf} disabled={loading || totalCount === 0} variant="outline" className="flex-grow sm:flex-grow-0 rounded-xl">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />} PDF
            </Button>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 shadow-xl border border-white/5 relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
              <Input 
                placeholder="Buscar contrato..." 
                className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                value={filters.searchTerm}
                onChange={e => setFilters(f => ({ ...f, searchTerm: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2 relative">
              <select
                className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                value={filters.estado}
                onChange={e => setFilters(f => ({ ...f, estado: e.target.value, municipio: 'todos' }))}
              >
                <option value="todos" className="bg-slate-900">Estado</option>
                {availableStates.map(e => <option key={e} value={e} className="bg-slate-900">{e}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            </div>

            <div className="md:col-span-2 relative">
              <SearchableSelect
                options={municipioOptions}
                value={filters.municipio}
                onChange={val => setFilters(f => ({ ...f, municipio: val }))}
                placeholder={`Município`}
                className="h-11 bg-white/10 border-white/20 rounded-xl"
              />
            </div>

            <div className="md:col-span-2 relative">
              <select
                className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                value={filters.statusContrato}
                onChange={e => setFilters(f => ({ ...f, statusContrato: e.target.value }))}
              >
                <option value="todos" className="bg-slate-900">Status</option>
                {availableStatus.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            </div>

            <div className="md:col-span-3 relative">
              <select
                className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                value={filters.statusVencimento}
                onChange={e => setFilters(f => ({ ...f, statusVencimento: e.target.value }))}
              >
                <option value="todos" className="bg-slate-900">Prazo: Todos</option>
                <option value="vencidos" className="bg-slate-900">Vencidos</option>
                <option value="vencendo_hoje" className="bg-slate-900">Vence Hoje</option>
                <option value="a_vencer_15" className="bg-slate-900">Vence em até 15 Dias</option>
                <option value="a_vencer_30" className="bg-slate-900">Vence em até 30 Dias</option>
                <option value="a_vencer_60" className="bg-slate-900">Vence em até 60 Dias</option>
                <option value="a_vencer_90" className="bg-slate-900">Vence em até 90 Dias</option>
                <option value="indeterminado" className="bg-slate-900">Prazo Indeterminado</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total de Contratos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-white">{metrics.total.toLocaleString('pt-BR')}</div></CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Contratos Vigentes</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-400">{metrics.vigentes.toLocaleString('pt-BR')}</div></CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-red-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Contratos Vencidos</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-500">{metrics.vencidos.toLocaleString('pt-BR')}</div></CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg border-l-4 border-l-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Ag. Assinatura</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-400">{metrics.aguardando}</div></CardContent>
          </Card>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableCell className="font-semibold">Nº Contrato</TableCell>
                    <TableCell className="font-semibold">Cliente</TableCell>
                    <TableCell className="font-semibold">Localidade</TableCell>
                    <TableCell className="font-semibold">Vigência (Fim)</TableCell>
                    <TableCell className="font-semibold text-center">Status de Vencimento</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" /></TableCell></TableRow>
                  ) : reportData.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-32 text-center text-gray-400">Nenhum contrato encontrado com os filtros.</TableCell></TableRow>
                  ) : (
                    reportData.map((item) => (
                      <TableRow key={item.id} className="border-white/5 hover:bg-white/5 transition-colors">
                        <TableCell data-label="Contrato" className="font-medium">
                          <span className="text-emerald-300 font-bold">{item.numero_contrato}</span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-white truncate max-w-xs" title={item.pessoa?.razao_social}>
                            {item.pessoa?.nome_fantasia || item.pessoa?.razao_social || 'Cliente não encontrado'}
                          </div>
                          {item.pessoa?.cnpj_cpf && <div className="text-xs text-white/50 bg-black/10 px-1 py-0.5 mt-0.5 rounded-md inline-block">{formatCnpjCpf(item.pessoa.cnpj_cpf)}</div>}
                        </TableCell>
                        <TableCell>
                          {item.pessoa && (
                            <div className="flex items-center gap-1 text-sm text-emerald-100/80">
                                <MapPin className="h-3 w-3 text-emerald-400" />
                                {municipioMap[item.pessoa.municipio] || item.pessoa.municipio}, {item.pessoa.estado}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm">
                            <span className="text-white flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-emerald-400" /> 
                                {format(parseISO(item.data_fim), 'dd/MM/yyyy')}
                            </span>
                            <span className="text-xs text-white/50 bg-white/5 w-fit px-2 py-0.5 rounded-md">
                                {item.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.dias_vencimento === null ? (
                            <div className="inline-flex items-center gap-2 text-slate-400 bg-slate-400/10 px-3 py-1 rounded-full text-xs font-bold border border-slate-400/20">
                              Indeterminado
                            </div>
                          ) : item.dias_vencimento < 0 ? (
                            <div className="inline-flex items-center gap-2 text-red-500 bg-red-500/10 px-3 py-1 rounded-full text-xs font-bold border border-red-500/20">
                              <AlertTriangle className="h-4 w-4" />
                              Vencido há {Math.abs(item.dias_vencimento)} dias
                            </div>
                          ) : item.dias_vencimento === 0 ? (
                            <div className="inline-flex items-center gap-2 text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full text-xs font-bold border border-yellow-400/20">
                              <Clock className="h-4 w-4" />
                              Vence hoje
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full text-xs font-bold border border-emerald-400/20">
                              <CheckCircle2 className="h-4 w-4" />
                              Vence em {item.dias_vencimento} dias
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

export default RelatorioContratosPage;
