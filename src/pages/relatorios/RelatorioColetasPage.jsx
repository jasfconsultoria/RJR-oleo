import React, { useState, useEffect, useMemo, useCallback } from 'react';
    import { Helmet } from 'react-helmet';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Label } from '@/components/ui/label';
    import { Loader2, FileDown, Droplets, Truck, DollarSign, Repeat, BarChart2, Search } from 'lucide-react'; // Adicionado Search
    import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
    import { estados, getMunicipios } from '@/lib/location';
    import { useProfile } from '@/contexts/ProfileContext'; // Corrigido o caminho de importação
    import { format, subDays, endOfDay, parseISO, isValid } from 'date-fns';
    import { ptBR } from 'date-fns/locale';
    import * as XLSX from 'xlsx';
    import { formatCurrency, formatNumber, escapePostgrestLikePattern } from '@/lib/utils';
    import { useDebounce } from '@/hooks/useDebounce';
    import { Input } from '@/components/ui/input';
    import { SearchableSelect } from '@/components/ui/SearchableSelect';
    // Removido: import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
    import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
    import { Pagination } from '@/components/ui/pagination';
    import { UserSearchableSelect } from '@/components/ui/UserSearchableSelect';

    const RelatoriosPage = () => {
      const [reportData, setReportData] = useState([]);
      const [loading, setLoading] = useState(true);
      // Removido: [clientes, setClientes] = useState([]);
      const [usuarios, setUsuarios] = useState([]);
      const [filters, setFilters] = useState({ 
        estado: 'all', 
        municipio: 'all',
        clientSearchTerm: '', // Alterado de clienteId para clientSearchTerm
        userId: 'all',
        startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
      });
      const [municipios, setMunicipiosList] = useState([]);
      const { toast } = useToast();
      const { profile } = useProfile();
      const debouncedFilters = useDebounce(filters, 500);
      const [currentPage, setCurrentPage] = useState(1);
      const [totalCount, setTotalCount] = useState(0);
      const [empresa, setEmpresa] = useState(null);

      const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

      const municipioOptions = useMemo(() => [{ value: 'all', label: 'Todos os Municípios' }, ...municipios.map(m => ({ value: m, label: m }))], [municipios]);

      useEffect(() => {
        const fetchInitialData = async () => {
          setLoading(true);
          try {
            const [usuariosRes, empresaRes] = await Promise.all([
              // Removido: supabase.from('clientes').select(...)
              supabase.rpc('get_all_users'),
              supabase.from('empresa').select('items_per_page').single()
            ]);

            // Removido: if (clientesRes.error) toast({ title: 'Erro ao buscar clientes', variant: 'destructive' });
            // Removido: else setClientes(clientesRes.data || []);

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

            if (empresaRes.error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
            else setEmpresa(empresaRes.data || { items_per_page: 25 });

          } catch (error) {
            toast({ title: 'Erro ao carregar dados iniciais', variant: 'destructive' });
          }
        };
        fetchInitialData();
      }, [toast]);

      const fetchReportData = useCallback(async (currentFilters) => {
        if (!empresa) return;
        setLoading(true);
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;

        let query = supabase.from('coletas').select('*, pessoa:clientes(nome, nome_fantasia), usuario:profiles(full_name)', { count: 'exact' }); // Added nome_fantasia to client select

        if (currentFilters.estado && currentFilters.estado !== 'all') query = query.eq('estado', currentFilters.estado);
        if (currentFilters.municipio && currentFilters.municipio !== 'all') query = query.eq('municipio', currentFilters.municipio);
        if (currentFilters.clientSearchTerm) {
          const escapedSearchTerm = escapePostgrestLikePattern(currentFilters.clientSearchTerm);
          query = query.or(`pessoa.nome.ilike.%${escapedSearchTerm}%,pessoa.nome_fantasia.ilike.%${escapedSearchTerm}%`); // Filtrar por nome do cliente
        }
        if (currentFilters.userId && currentFilters.userId !== 'all') query = query.eq('user_id', currentFilters.userId);
        if (currentFilters.startDate) query = query.gte('data_coleta', currentFilters.startDate);
        if (currentFilters.endDate) {
            const endOfDayDate = format(endOfDay(parseISO(currentFilters.endDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            query = query.lte('data_coleta', endOfDayDate);
        }
        
        query = query.order('data_coleta', { ascending: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) {
          toast({ title: 'Erro ao gerar relatório', description: error.message, variant: 'destructive' });
          setReportData([]);
        } else {
          setReportData(data || []);
          setTotalCount(count || 0);
        }
        setLoading(false);
      }, [toast, currentPage, pageSize, empresa]);

      useEffect(() => {
        if (empresa) {
          fetchReportData(debouncedFilters);
        }
      }, [debouncedFilters, fetchReportData, empresa]);

      useEffect(() => {
        setCurrentPage(1);
      }, [debouncedFilters, pageSize]);

      useEffect(() => {
        if (profile?.role === 'coletor' && profile.estado) {
          setFilters(prev => ({ ...prev, estado: profile.estado }));
          setMunicipiosList(getMunicipios(profile.estado));
        }
      }, [profile]);

      useEffect(() => {
        if (filters.estado && filters.estado !== 'all') {
          setMunicipiosList(getMunicipios(filters.estado));
        } else {
          setMunicipiosList([]);
          setFilters(prev => ({ ...prev, municipio: 'all' }));
        }
      }, [filters.estado]);

      const handleExportExcel = async () => {
        if (totalCount === 0) {
          toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
          return;
        }
        
        setLoading(true);
        let allData = [];
        const totalPagesToFetch = Math.ceil(totalCount / 500); // Fetch in larger chunks for export

        for (let i = 0; i < totalPagesToFetch; i++) {
          const from = i * 500;
          const to = from + 500 - 1;
          
          let query = supabase.from('coletas').select('*, pessoa:clientes(nome, nome_fantasia), usuario:profiles(full_name)'); // Added nome_fantasia
          if (filters.estado && filters.estado !== 'all') query = query.eq('estado', filters.estado);
          if (filters.municipio && filters.municipio !== 'all') query = query.eq('municipio', filters.municipio);
          if (filters.clientSearchTerm) {
            const escapedSearchTerm = escapePostgrestLikePattern(filters.clientSearchTerm);
            query = query.or(`pessoa.nome.ilike.%${escapedSearchTerm}%,pessoa.nome_fantasia.ilike.%${escapedSearchTerm}%`); // Filtrar por nome do cliente
          }
          if (filters.userId && filters.userId !== 'all') query = query.eq('user_id', filters.userId);
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
          allData = [...allData, ...data];
        }
        setLoading(false);

        const dataToExport = allData.map(item => {
          const dateObj = parseISO(item.data_coleta);
          const formattedDate = isValid(dateObj) ? format(dateObj, 'dd/MM/yyyy', { locale: ptBR }) : 'N/A';
          const clientDisplayName = item.pessoa?.nome_fantasia ? `${item.pessoa.nome} - ${item.pessoa.nome_fantasia}` : item.pessoa?.nome || item.cliente_nome;
          return {
            'Data Coleta': formattedDate,
            'Cliente': clientDisplayName, // Use concatenated name
            'Usuário': item.usuario?.full_name || 'N/A',
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

      const summary = useMemo(() => {
        return reportData.reduce((acc, item) => {
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
      }, [reportData]);

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
              <CardHeader className="p-0 pt-4 px-6">
                {/* Removed Filter Icon and Title */}
              </CardHeader>
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
                        <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl"><SelectItem value="all">Todos os Estados</SelectItem>{estados.map(e => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
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
                        <CardContent><div className="text-2xl font-bold">{totalCount}</div></CardContent>
                      </Card>
                      <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Massa Total Coletada</CardTitle><Droplets className="h-4 w-4 text-gray-400" /></CardHeader>
                        <CardContent><div className="2xl font-bold">{formatNumber(summary.totalMassa)} kg</div></CardContent>
                      </Card>
                       <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total Pago (Compras)</CardTitle><DollarSign className="h-4 w-4 text-gray-400" /></CardHeader>
                        <CardContent><div className="2xl font-bold">{formatCurrency(summary.totalPago)}</div></CardContent>
                      </Card>
                       <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total Entregue (Trocas/Doações)</CardTitle><Repeat className="h-4 w-4 text-gray-400" /></CardHeader>
                        <CardContent><div className="2xl font-bold">{formatNumber(summary.totalEntregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades</div></CardContent>
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
                                const clientDisplayName = item.pessoa?.nome_fantasia ? `${item.pessoa.nome} - ${item.pessoa.nome_fantasia}` : item.pessoa?.nome || item.cliente_nome;
                                return (
                                  <TableRow key={item.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                                    <TableCell data-label="Data">{formattedDate}</TableCell>
                                    <TableCell data-label="Cliente">{clientDisplayName}</TableCell>
                                    <TableCell data-label="Usuário">{item.usuario?.full_name || 'N/A'}</TableCell>
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
                                    <TableCell colSpan={5}>Totais (Página)</TableCell>
                                    <TableCell className="text-right">{formatNumber(summary.totalMassa)} kg</TableCell>
                                    <TableCell className="text-right">{`${formatCurrency(summary.totalPago)} / ${formatNumber(summary.totalEntregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades`}</TableCell>
                                </TableRow>
                            </TableFooter>
                          </Table>
                           <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
                            <div className="flex justify-between items-center">
                              <span>Total Massa (Página):</span>
                              <span>{formatNumber(summary.totalMassa)} kg</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Total Pago/Entregue (Página):</span>
                              <span>{`${formatCurrency(summary.totalPago)} / ${formatNumber(summary.totalEntregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades`}</span>
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