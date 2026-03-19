import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Package, Box, RefreshCw, FileText, ArrowUp, ArrowDown, ArrowUpDown, MapPin, Building2, Users } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDebounce } from '@/hooks/useDebounce';
import ClientesFilters from '@/components/clientes/ClientesFilters';
import { formatCnpjCpf } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLocationData } from '@/hooks/useLocationData';

// Componente Header com Ordenação
const TableHeaderSortable = ({ columnKey, label, sortConfig, onSort, className }) => {
  const getSortIcon = () => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <TableHead
      onClick={() => onSort(columnKey)}
      className={cn("cursor-pointer text-emerald-300", className)}
    >
      <div className="flex items-center">
        {label} {getSortIcon()}
      </div>
    </TableHead>
  );
};

const RecipientesPage = () => {
  const { fetchMunicipiosByCodes } = useLocationData();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [Resumo, setResumo] = useState({ total_com_clientes: 0 });
  
  // Modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterEstado, setFilterEstado] = useState('todos');
  const [filterMunicipio, setFilterMunicipio] = useState('todos');

  // Pagination and Sort State
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState(null);
  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj_cpf, recipientes_saldo, endereco, municipio, estado')
        .order('razao_social', { ascending: true });

      if (error) throw error;

      let processedData = data || [];
      const codes = [...new Set(processedData.map(c => c.municipio).filter(m => m && !isNaN(m)))];
      
      if (codes.length > 0) {
        const mapping = await fetchMunicipiosByCodes(codes);
        processedData = processedData.map(c => ({
          ...c,
          municipio_nome: mapping[c.municipio] || c.municipio,
        }));
      } else {
        processedData = processedData.map(c => ({
          ...c,
          municipio_nome: c.municipio,
        }));
      }

      setClientes(processedData);
      
      const totalCli = processedData.reduce((acc, c) => acc + (c.recipientes_saldo || 0), 0);
      setResumo({ total_com_clientes: totalCli });

    } catch (error) {
       console.error('Error fetching container data:', error);
       toast({ title: 'Erro', description: 'Não foi possível carregar os dados.', variant: 'destructive' });
    } finally {
       setLoading(false);
    }
  };

  const handleOpenHistory = async (cliente) => {
    setSelectedCliente(cliente);
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('movimentacoes_recipientes')
        .select('*')
        .eq('cliente_id', cliente.id)
        .order('data_movimento', { ascending: false });

      if (error) throw error;
      
      let moves = data || [];
      
      // Injetar linha sintética se extrato vazio mas tem saldo
      if (moves.length === 0 && cliente.recipientes_saldo > 0) {
        moves = [{
          id: 'synthetic-initial',
          data_movimento: new Date().toISOString(),
          tipo_operacao: 'Ajuste de Saldo Legado',
          quantidade_entregue: cliente.recipientes_saldo,
          quantidade_coletada: 0,
          saldo_anterior: 0,
          saldo_novo: cliente.recipientes_saldo,
          observacao: 'Movimentação anterior ao início do rastreio detalhado.'
        }];
      }

      setMovimentacoes(moves);
    } catch (error) {
       console.error('Error fetching history:', error);
       toast({ title: 'Erro', description: 'Não foi possível ler o histórico.', variant: 'destructive' });
    } finally {
       setLoadingHistory(false);
    }
  };

  // Derive filter options
  const estados = useMemo(() => {
    return [...new Set(clientes.map(c => c.estado).filter(Boolean))].sort();
  }, [clientes]);

  const municipios = useMemo(() => {
    let filteredForMun = clientes;
    if (filterEstado !== 'todos') {
      filteredForMun = clientes.filter(c => c.estado === filterEstado);
    }
    const munList = [...new Set(filteredForMun.map(c => c.municipio_nome).filter(Boolean))].sort();
    return munList.map(m => ({ value: m, label: m }));
  }, [clientes, filterEstado]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredClientes = useMemo(() => {
    // 1. Initial filter: Only show saldo > 0 IF there is no search term
    let result = clientes.filter(c => (c.recipientes_saldo > 0) || (debouncedSearchTerm.trim() !== ''));

    // Search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      result = result.filter(c => {
        const razaoSocial = c.razao_social || '';
        const nomeFantasia = c.nome_fantasia || '';
        const cnpjCpf = c.cnpj_cpf || '';
        const municipio = c.municipio_nome || '';
        const estado = c.estado || '';
        return razaoSocial.toLowerCase().includes(searchLower) || 
               nomeFantasia.toLowerCase().includes(searchLower) ||
               cnpjCpf.toLowerCase().includes(searchLower) ||
               municipio.toLowerCase().includes(searchLower) ||
               estado.toLowerCase().includes(searchLower);
      });
    }

    // State filter
    if (filterEstado !== 'todos') {
      result = result.filter(c => c.estado === filterEstado);
    }

    // City filter
    if (filterMunicipio !== 'todos') {
      result = result.filter(c => c.municipio_nome === filterMunicipio);
    }

    // Sorting
    if (sortConfig !== null) {
      result.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [clientes, debouncedSearchTerm, filterEstado, filterMunicipio, sortConfig]);
  
  // Stats para os cards de resumo
  const stats = useMemo(() => {
    // Clientes por Estado (ignora filtro de município e busca)
    const clientsInEstado = filterEstado === 'todos' ? clientes : clientes.filter(c => c.estado === filterEstado);
    const totalEstado = clientsInEstado.reduce((acc, c) => acc + (c.recipientes_saldo || 0), 0);
    const mediaEstado = clientsInEstado.length > 0 ? (totalEstado / clientsInEstado.length).toFixed(1) : 0;

    // Clientes por Município (ignora busca, respeita filtro de estado)
    const clientsInMunicipio = filterMunicipio === 'todos' 
      ? clientsInEstado 
      : clientsInEstado.filter(c => c.municipio_nome === filterMunicipio);
    const totalMunicipio = clientsInMunicipio.reduce((acc, c) => acc + (c.recipientes_saldo || 0), 0);
    const mediaMunicipio = clientsInMunicipio.length > 0 ? (totalMunicipio / clientsInMunicipio.length).toFixed(1) : 0;

    // Geral (respeita TODOS os filtros, inclusive busca)
    const totalGlobalFiltro = filteredClientes.reduce((acc, c) => acc + (c.recipientes_saldo || 0), 0);
    const mediaGlobalFiltro = filteredClientes.length > 0 ? (totalGlobalFiltro / filteredClientes.length).toFixed(1) : 0;
    
    return {
      totalEstado,
      totalMunicipio,
      totalGlobalFiltro,
      mediaEstado,
      mediaMunicipio,
      mediaGlobalFiltro,
      estadoNome: filterEstado === 'todos' ? 'Geral' : filterEstado,
      municipioNome: filterMunicipio === 'todos' ? 'Geral' : filterMunicipio
    };
  }, [clientes, filteredClientes, filterEstado, filterMunicipio]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterEstado, filterMunicipio]);

  const paginatedData = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize;
    return filteredClientes.slice(from, to);
  }, [filteredClientes, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredClientes.length / pageSize);

  const mockLabels = {
    singularNoun: 'cliente',
    singularArticle: 'o'
  };

  return (
    <>
      <Helmet>
        <title>Recipientes por Cliente - RJR Óleo</title>
      </Helmet>

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <Package className="w-8 h-8 text-emerald-400" />
              Recipientes por Cliente
            </h1>
            <p className="text-emerald-200/80 mt-1">Visão geral e saldos de recipientes (bombonas) por cliente com histórico.</p>
          </div>
        </motion.div>

        {/* Dashboard Resumo - Oculto a pedido do usuário
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-emerald-900 border-emerald-700 shadow-lg shadow-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-300 font-medium whitespace-nowrap">Total Recipientes</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats.totalGlobalFiltro}</p>
                  <p className="text-xs text-emerald-400/60 mt-1 uppercase tracking-wider">No Filtro</p>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Box className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-900 border-emerald-700 shadow-lg shadow-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-300 font-medium whitespace-nowrap">Média / Estado</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats.mediaEstado}</p>
                  <div className="flex flex-col mt-1">
                    <span className="text-xs text-emerald-400/60 uppercase tracking-wider">{stats.estadoNome}</span>
                    <span className="text-[10px] text-white/40 italic">Total: {stats.totalEstado}</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-900 border-emerald-700 shadow-lg shadow-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-300 font-medium whitespace-nowrap">Média / Município</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats.mediaMunicipio}</p>
                  <div className="flex flex-col mt-1">
                    <span className="text-xs text-emerald-400/60 uppercase tracking-wider">{stats.municipioNome}</span>
                    <span className="text-[10px] text-white/40 italic">Total: {stats.totalMunicipio}</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-900 border-emerald-700 shadow-lg shadow-emerald-500/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-300 font-medium whitespace-nowrap">Média / Cliente</p>
                  <p className="text-3xl font-bold text-white mt-1">{stats.mediaGlobalFiltro}</p>
                  <p className="text-xs text-emerald-400/60 mt-1 uppercase tracking-wider">No Filtro Atual</p>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        */}

        {/* Search and Filters Bar */}
        <ClientesFilters
          searchTerm={searchTerm}
          updateSearchTerm={setSearchTerm}
          filterEstado={filterEstado}
          setFilterEstado={setFilterEstado}
          filterMunicipio={filterMunicipio}
          setFilterMunicipio={setFilterMunicipio}
          estados={estados}
          municipios={municipios}
          labels={mockLabels}
        />

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl"
        >
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="border-white/20 hover:bg-transparent">
                    <TableHeaderSortable
                      columnKey="razao_social"
                      label="Nome Fantasia / Razão Social"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className="w-[30%]"
                    />
                    <TableHeaderSortable
                      columnKey="cnpj_cpf"
                      label="CPF/CNPJ"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className="w-[15%]"
                    />
                    <TableHeaderSortable
                      columnKey="municipio_nome"
                      label="Localização"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className="w-[15%]"
                    />
                    <TableHeaderSortable
                      columnKey="recipientes_saldo"
                      label="Saldo Atual"
                      sortConfig={sortConfig}
                      onSort={requestSort}
                      className="w-[15%] text-center"
                    />
                    <TableHead className="text-emerald-300 text-right w-[10%]">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? (
                    paginatedData.map((c) => (
                      <TableRow key={c.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Nome Fantasia / Razão Social" className="font-medium">
                          {c.nome_fantasia && c.razao_social
                            ? `${c.nome_fantasia} - ${c.razao_social}`
                            : c.nome_fantasia || c.razao_social || 'Nome não informado'
                          }
                        </TableCell>
                        <TableCell data-label="CPF/CNPJ">
                          {c.cnpj_cpf ? formatCnpjCpf(c.cnpj_cpf) : '-'}
                        </TableCell>
                        <TableCell data-label="Localização">
                           {c.municipio_nome}, {c.estado}
                        </TableCell>
                        <TableCell data-label="Saldo Atual" className="text-center">
                          <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-bold">
                            {c.recipientes_saldo}
                          </span>
                        </TableCell>
                        <TableCell className="actions-cell text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenHistory(c)} title="Ver Extrato" className="text-emerald-300 hover:text-white">
                            <FileText className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-white/70">
                        Nenhum cliente com recipiente encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </motion.div>

        {/* Pagination */}
        {filteredClientes.length > 0 && !loading && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            totalCount={filteredClientes.length}
          />
        )}

        {/* Modal de Histórico */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="bg-emerald-950 border-emerald-800 text-white max-w-3xl max-h-[80vh] overflow-y-auto w-[90vw] md:w-full">
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl flex justify-between items-center text-white">
                <span>Extrato de Recipientes: {selectedCliente?.nome_fantasia || selectedCliente?.razao_social}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {loadingHistory ? (
                <div className="flex justify-center"><RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto rounded-xl">
                  <Table className="responsive-table">
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-emerald-300">Data e Hora</TableHead>
                        <TableHead className="text-emerald-300">Operação</TableHead>
                        <TableHead className="text-emerald-300 text-center text-xs px-1">Entregues (Vazios)</TableHead>
                        <TableHead className="text-emerald-300 text-center text-xs px-1">Coletados (Cheios)</TableHead>
                        <TableHead className="text-emerald-300 text-right">Saldo Final</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoes.length > 0 ? (
                        movimentacoes.map(m => (
                          <TableRow key={m.id} className="border-white/10 text-white/90 hover:bg-white/5 text-sm">
                            <TableCell data-label="Data">{format(new Date(m.data_movimento), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                            <TableCell data-label="Operação">
                              <span className="capitalize">{m.tipo_operacao}</span>
                              {m.coleta_id && <span className="text-xs text-white/40 md:ml-2 block md:inline">(Coleta)</span>}
                            </TableCell>
                            <TableCell data-label="Entregues" className="text-center text-emerald-400 font-bold">
                              {m.quantidade_entregue > 0 ? `+${m.quantidade_entregue}` : '-'}
                            </TableCell>
                            <TableCell data-label="Coletados" className="text-center text-red-400 font-bold">
                              {m.quantidade_coletada > 0 ? `-${m.quantidade_coletada}` : '-'}
                            </TableCell>
                            <TableCell data-label="Saldo Final" className="text-right font-bold">{m.saldo_novo}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                         <TableRow><TableCell colSpan={5} className="text-center text-white/50 p-4">Sem movimentações.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default RecipientesPage;
