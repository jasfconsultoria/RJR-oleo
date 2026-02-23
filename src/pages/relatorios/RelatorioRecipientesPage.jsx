import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, FileDown, Box, Search, Users } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import * as XLSX from 'xlsx';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { formatNumber } from '@/lib/utils';

const RelatorioRecipientesPage = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const { toast } = useToast();

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ title: "Erro ao buscar configurações da empresa.", variant: "destructive" });
      }
      setEmpresa(data || { items_per_page: 25 });
    };
    fetchEmpresaData();
  }, [toast]);

  // Função para buscar dados do relatório
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('get_recipientes_report');

      if (error) {
        console.error('Erro ao buscar relatório:', error);
        toast({ 
          title: 'Erro ao gerar relatório de recipientes', 
          description: error.message, 
          variant: 'destructive' 
        });
        setReportData([]);
        setTotalCount(0);
      } else {
        console.log('Dados recebidos:', data); // Para debug
        
        // Filtro corrigido - busca em razao_social e nome_fantasia
        const filteredData = (data || []).filter(item => {
          const searchLower = debouncedSearchTerm.toLowerCase();
          
          // Verifica se os campos existem antes de acessá-los
          const razaoSocial = item.razao_social || item.cliente_nome || '';
          const nomeFantasia = item.nome_fantasia || item.cliente_nome_fantasia || '';
          
          return (
            razaoSocial.toLowerCase().includes(searchLower) ||
            nomeFantasia.toLowerCase().includes(searchLower)
          );
        });
        
        setReportData(filteredData);
        setTotalCount(filteredData.length);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast({ 
        title: 'Erro inesperado', 
        description: 'Ocorreu um erro ao buscar os dados', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, [toast, debouncedSearchTerm]); // Removida dependência do empresa

  // Buscar dados quando o termo de busca mudar ou quando empresa for carregada
  useEffect(() => {
    if (empresa) {
      fetchReportData();
    }
  }, [debouncedSearchTerm, empresa]); // Dependências simplificadas

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  const paginatedData = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize;
    return reportData.slice(from, to);
  }, [reportData, currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const summary = useMemo(() => {
    return reportData.reduce((acc, item) => {
      acc.totalClientes += 1;
      acc.totalRecipientes += Number(item.total_recipientes) || 0;
      return acc;
    }, { totalClientes: 0, totalRecipientes: 0 });
  }, [reportData]);

  // Função para obter o nome de exibição do cliente
  const getClientDisplayName = (item) => {
    const nomeFantasia = item.nome_fantasia || item.cliente_nome_fantasia || '';
    const razaoSocial = item.razao_social || item.cliente_nome || '';
    
    if (nomeFantasia && razaoSocial) {
      return `${nomeFantasia} - ${razaoSocial}`;
    }
    return nomeFantasia || razaoSocial || 'Cliente sem nome';
  };

  const handleExportExcel = () => {
    if (reportData.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Filtre os dados que deseja exportar.',
        variant: 'destructive',
      });
      return;
    }

    const dataToExport = reportData.map(item => ({
      'Cliente': getClientDisplayName(item),
      'Total de Recipientes': item.total_recipientes,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'RelatorioRecipientes');
    XLSX.writeFile(workbook, 'Relatorio_Recipientes.xlsx');
  };

  return (
    <>
      <Helmet><title>Relatório de Recipientes - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Box className="w-8 h-8 text-emerald-400" /> Relatório de Recipientes
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize a quantidade de recipientes por cliente com contratos ativos.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button onClick={handleExportExcel} disabled={totalCount === 0 || loading} variant="outline" className="flex-grow sm:flex-grow-0 rounded-xl">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />} Exportar
            </Button>
          </div>
        </div>
        
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl relative z-20">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 items-end">
                <div>
                  <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar Cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                    <Input
                      id="searchTerm"
                      type="search"
                      placeholder="Nome fantasia ou razão social..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
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
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total de Clientes</CardTitle><Users className="h-4 w-4 text-gray-400" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{summary.totalClientes}</div></CardContent>
                  </Card>
                  <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-emerald-300">Total de Recipientes</CardTitle><Box className="h-4 w-4 text-gray-400" /></CardHeader>
                    <CardContent><div className="2xl font-bold">{formatNumber(summary.totalRecipientes, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div></CardContent>
                  </Card>
                </div>

                <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
                  <CardHeader><CardTitle className="text-emerald-300">Dados do Relatório</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table className="responsive-table">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                            <th className="p-2 text-left text-white">Cliente</th>
                            <th className="p-2 text-right text-white">Total de Recipientes</th>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedData.map(item => (
                            <TableRow key={item.cliente_id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                              <TableCell data-label="Cliente">{getClientDisplayName(item)}</TableCell>
                              <TableCell data-label="Total de Recipientes" className="text-right">
                                {formatNumber(item.total_recipientes, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="hover:bg-transparent border-t-2 border-emerald-500 font-bold hidden md:table-row">
                                <TableCell>Totais (Geral)</TableCell>
                                <TableCell className="text-right">{formatNumber(summary.totalRecipientes, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</TableCell>
                            </TableRow>
                        </TableFooter>
                      </Table>
                       <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span>Total de Recipientes (Geral):</span>
                          <span>{formatNumber(summary.totalRecipientes, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
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

export default RelatorioRecipientesPage;