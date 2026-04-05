import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, ClipboardCheck, Search, Warehouse, ArrowUpSquare, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { format, endOfDay, startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';
import * as XLSX from 'xlsx';
import { formatNumber, formatDateWithTimezone, getZonedStartOfMonth, getZonedEndOfMonth } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import ProdutoSearchableSelect from '@/components/produtos/ProdutoSearchableSelect';
import { Badge } from '@/components/ui/badge';

const RelatorioAuditoriaPage = () => {
  const [loading, setLoading] = useState(true);
  const [coletasData, setColetasData] = useState([]);
  const [movementsData, setMovementsData] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    selectedProductId: null,
  });
  
  const { toast } = useToast();
  const debouncedFilters = useDebounce(filters, 500);

  const empresaTimezone = useMemo(() => empresa?.timezone || 'America/Sao_Paulo', [empresa]);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('empresa').select('items_per_page, timezone').single();
        if (error) throw error;
        
        const empresaData = data || { items_per_page: 25, timezone: 'America/Sao_Paulo' };
        setEmpresa(empresaData);
        setFilters(prev => ({
          ...prev,
          startDate: getZonedStartOfMonth(empresaData.timezone),
          endDate: getZonedEndOfMonth(empresaData.timezone)
        }));
      } catch (error) {
        toast({ title: 'Erro ao buscar configurações', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  const fetchAuditData = useCallback(async () => {
    if (!empresa || !filters.startDate || !filters.endDate) return;
    setLoading(true);

    const startDateISO = format(filters.startDate, 'yyyy-MM-dd');
    const endDateISO = format(filters.endDate, 'yyyy-MM-dd');

    try {
      // 1. Buscar Coletas de Troca
      let coletasQuery = supabase
        .from('coletas')
        .select('id, numero_coleta, data_coleta, tipo_coleta, quantidade_entregue, cliente_id, clientes(razao_social, nome_fantasia), recibos(assinatura_url)')
        .eq('tipo_coleta', 'Troca')
        .gte('data_coleta', startDateISO)
        .lte('data_coleta', endDateISO);

      // 2. Buscar Movimentações de Saída
      let movementsQuery = supabase
        .from('entrada_saida')
        .select('id, data, tipo, origem, document_number, coleta_id, itens_entrada_saida(quantidade, produto_id, produtos(nome))')
        .eq('tipo', 'saida')
        .gte('data', startDateISO)
        .lte('data', endDateISO);

      const [coletasRes, movementsRes] = await Promise.all([coletasQuery, movementsQuery]);

      if (coletasRes.error) throw coletasRes.error;
      if (movementsRes.error) throw movementsRes.error;

      // Filtrar por Produto na memória se necessário (já que a estrutura de itens é aninhada)
      let filteredColetas = coletasRes.data || [];
      let filteredMovements = movementsRes.data || [];

      if (filters.selectedProductId) {
        // No caso das saídas, filtramos pelos itens
        filteredMovements = filteredMovements.filter(m => 
          m.itens_entrada_saida?.some(item => item.produto_id === filters.selectedProductId)
        );
        // Nota: Coletas de "Troca" geralmente são de Óleo Novo, mas o sistema pode ter outros.
        // Como o filtro é geral, aplicamos o critério de que se houver um produto selecionado,
        // apenas mostramos audit de movimentos desse produto.
      }

      setColetasData(filteredColetas);
      setMovementsData(filteredMovements);

    } catch (error) {
      toast({ title: 'Erro ao carregar auditoria', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [empresa, filters, toast]);

  useEffect(() => {
    if (empresa) fetchAuditData();
  }, [fetchAuditData, empresa]);

  const auditSummary = useMemo(() => {
    const totalColetas = coletasData.length;
    let sumColetasQty = 0;
    const matchedColetaIds = new Set();
    const missingColetas = [];
    const manualMovements = [];
    let totalSaidasQty = 0;

    const movMap = new Map();
    movementsData.forEach(m => {
      const qty = m.itens_entrada_saida?.[0]?.quantidade || 0;
      totalSaidasQty += Number(qty);
      if (m.coleta_id) {
        movMap.set(m.coleta_id, m);
      } else if (m.origem === 'manual') {
        manualMovements.push(m);
      }
    });

    coletasData.forEach(c => {
      sumColetasQty += Number(c.quantidade_entregue);
      if (movMap.has(c.id)) {
        matchedColetaIds.add(c.id);
      } else {
        missingColetas.push(c);
      }
    });

    return {
      totalColetas,
      sumColetasQty,
      coletasWithExit: matchedColetaIds.size,
      missingColetas,
      manualMovements,
      totalSaidasQty,
      matchedColetaIds
    };
  }, [coletasData, movementsData]);

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleExportExcel = () => {
    const dataToExport = [
      ...auditSummary.missingColetas.map(c => ({
        'Tipo': 'COLETA SEM SAÍDA',
        'Nº Documento': c.numero_coleta || 'N/A',
        'Data': formatDateWithTimezone(c.data_coleta, empresaTimezone),
        'Cliente': c.clientes?.nome_fantasia || c.clientes?.razao_social || 'N/A',
        'Quantidade': formatNumber(c.quantidade_entregue),
        'Status': c.recibos?.[0]?.assinatura_url ? 'Assinado' : 'Aguardando Assinatura'
      })),
      ...auditSummary.manualMovements.map(m => ({
        'Tipo': 'SAÍDA MANUAL (AJUSTE)',
        'Nº Documento': m.document_number || 'N/A',
        'Data': formatDateWithTimezone(m.data, empresaTimezone),
        'Cliente': 'N/A',
        'Quantidade': formatNumber(m.itens_entrada_saida?.[0]?.quantidade || 0),
        'Status': 'Lançado Manualmente'
      }))
    ];

    if (dataToExport.length === 0) {
      toast({ title: 'Sem dados para exportar' });
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AuditoriaEstoque');
    XLSX.writeFile(workbook, `Auditoria_Estoque_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
  };

  return (
    <>
      <Helmet><title>Auditoria de Estoque - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-8 h-8 text-emerald-400" /> Auditoria
            </h1>
            <p className="text-emerald-200/80 mt-1">Cruzamento entre Coletas de Troca e Saídas Automáticas.</p>
          </div>
          <Button onClick={handleExportExcel} disabled={loading} variant="outline" className="rounded-xl">
             <FileDown className="mr-2 h-4 w-4" /> Exportar Auditoria
          </Button>
        </div>

        {/* Filtros */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl relative z-20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="lg:col-span-2">
                <ProdutoSearchableSelect
                  labelText="Produto"
                  value={filters.selectedProductId}
                  onChange={(p) => handleFilterChange('selectedProductId', p?.id)}
                  placeholder="Filtrar por produto..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block text-white mb-1 text-sm">Início</Label>
                  <input
                    type="date"
                    className="flex ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    value={filters.startDate ? (filters.startDate instanceof Date ? format(filters.startDate, 'yyyy-MM-dd') : filters.startDate) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const date = parseISO(val);
                        if (isValid(date)) handleFilterChange('startDate', date);
                      } else {
                        handleFilterChange('startDate', null);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label className="block text-white mb-1 text-sm">Fim</Label>
                  <input
                    type="date"
                    className="flex ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    value={filters.endDate ? (filters.endDate instanceof Date ? format(filters.endDate, 'yyyy-MM-dd') : filters.endDate) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const date = parseISO(val);
                        if (isValid(date)) handleFilterChange('endDate', date);
                      } else {
                        handleFilterChange('endDate', null);
                      }
                    }}
                  />
                </div>
              </div>
              <Button onClick={() => fetchAuditData()} className="bg-emerald-600 hover:bg-emerald-500 rounded-xl">
                <Search className="w-4 h-4 mr-2" /> Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>
        ) : (
          <div className="space-y-6">
            {/* Quick Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                <CardHeader className="pb-2">
                  <div className="text-xs font-semibold text-emerald-300 uppercase">Total Coletas (Troca)</div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditSummary.totalColetas}</div>
                  <p className="text-[10px] text-emerald-200/50 mt-1">Volume total: {formatNumber(auditSummary.sumColetasQty)} unidades</p>
                </CardContent>
              </Card>
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                <CardHeader className="pb-2">
                  <div className="text-xs font-semibold text-emerald-300 uppercase">Saídas Automáticas</div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{auditSummary.coletasWithExit}</div>
                  <p className="text-[10px] text-emerald-200/50 mt-1">Coletas assinadas geraram saída.</p>
                </CardContent>
              </Card>
              <Card className="bg-red-500/10 backdrop-blur-sm border-red-500/20 text-white rounded-xl">
                <CardHeader className="pb-2">
                  <div className="text-xs font-semibold text-red-300 uppercase">Pendentes de Saída</div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-400">{auditSummary.missingColetas.length}</div>
                  <p className="text-[10px] text-red-300/50 mt-1">Aguardando assinatura do recibo.</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-500/10 backdrop-blur-sm border-blue-500/20 text-white rounded-xl">
                <CardHeader className="pb-2">
                  <div className="text-xs font-semibold text-blue-300 uppercase">Saídas Totais</div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">{formatNumber(auditSummary.totalSaidasQty)}</div>
                  <p className="text-[10px] text-blue-300/50 mt-1">Inclui {auditSummary.manualMovements.length} ajustes manuais.</p>
                </CardContent>
              </Card>
            </div>

            {/* Reconciliation Logic Card */}
            <Card className="bg-white/5 border-white/10 rounded-xl">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-emerald-300 mt-1" />
                  <div>
                    <h3 className="font-bold text-emerald-300">Resumo da Conciliação</h3>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                      <div className="space-y-2 text-emerald-100/90">
                        <p>Total em Coletas: <span className="font-bold">{formatNumber(auditSummary.sumColetasQty)}</span></p>
                        <p>(-) Pendentes de Assinatura: <span className="font-bold text-red-300">-{formatNumber(auditSummary.missingColetas.reduce((acc, c) => acc + Number(c.quantidade_entregue), 0))}</span></p>
                        <hr className="border-white/10" />
                        <p>= Saídas Coletas Assinadas: <span className="font-bold">{formatNumber(auditSummary.sumColetasQty - auditSummary.missingColetas.reduce((acc, c) => acc + Number(c.quantidade_entregue), 0))}</span></p>
                      </div>
                      <div className="space-y-2 text-emerald-100/90">
                        <p>(+) Saídas Manuais (Ajustes): <span className="font-bold text-blue-300">+{formatNumber(auditSummary.manualMovements.reduce((acc, m) => acc + Number(m.itens_entrada_saida?.[0]?.quantidade || 0), 0))}</span></p>
                        <hr className="border-white/10" />
                        <p className="text-lg">= Total Geral de Saídas: <span className="font-bold text-emerald-400">{formatNumber(auditSummary.totalSaidasQty)}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Missing Coletas Table */}
            <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-emerald-300 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" /> Coletas Pendentes de Saída (Sem Assinatura)
                </CardTitle>
                <Badge variant="outline" className="border-red-400 text-red-400">{auditSummary.missingColetas.length} Registros</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/20">
                      <th className="p-2 text-left">Nº Coleta</th>
                      <th className="p-2 text-left">Data</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-right">Qtd. Entrega</th>
                      <th className="p-2 text-center">Status Recibo</th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditSummary.missingColetas.length > 0 ? (
                      auditSummary.missingColetas.map(c => (
                        <TableRow key={c.id} className="border-b border-white/5 hover:bg-white/5">
                          <TableCell className="font-mono text-emerald-300">{c.numero_coleta.toString().padStart(6, '0')}</TableCell>
                          <TableCell>{formatDateWithTimezone(c.data_coleta, empresaTimezone)}</TableCell>
                          <TableCell className="max-w-xs truncate">{c.clientes?.nome_fantasia || c.clientes?.razao_social}</TableCell>
                          <TableCell className="text-right font-bold">{formatNumber(c.quantidade_entregue)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pendente</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-4 text-emerald-300/50">Nenhuma coleta pendente no período.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Manual Movements Table */}
            {auditSummary.manualMovements.length > 0 && (
              <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                <CardHeader>
                  <CardTitle className="text-blue-300">Movimentações Manuais (Ajustes de Estoque)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-white/20">
                        <th className="p-2 text-left">Nº Documento</th>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-right">Quantidade</th>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-left">Observação</th>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditSummary.manualMovements.map(m => (
                        <TableRow key={m.id} className="border-b border-white/5 hover:bg-white/5">
                          <TableCell className="font-mono text-blue-300">{m.document_number || 'S/N'}</TableCell>
                          <TableCell>{formatDateWithTimezone(m.data, empresaTimezone)}</TableCell>
                          <TableCell className="text-right font-bold">{formatNumber(m.itens_entrada_saida?.[0]?.quantidade || 0)}</TableCell>
                          <TableCell>{m.itens_entrada_saida?.[0]?.produtos?.nome}</TableCell>
                          <TableCell className="text-xs text-gray-400 italic">Lançamento de Ajuste Manual</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default RelatorioAuditoriaPage;
