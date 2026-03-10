import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BookText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Filter, Calendar } from 'lucide-react'; // Adicionado Calendar

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [availableActions, setAvailableActions] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { toast } = useToast();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  useEffect(() => {
    const fetchFilterData = async () => {
      // Fetch unique users from profiles
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      
      if (!usersError) setAvailableUsers(users || []);

      // Fetch ALL unique actions using a RPC function (server-side SELECT DISTINCT)
      const { data: actions, error: actionsError } = await supabase
        .rpc('get_distinct_log_actions');
      
      if (!actionsError && actions) {
        // As actions are already distinct and sorted by the RPC
        setAvailableActions(actions.map(a => typeof a === 'object' ? a.action : a));
      } else if (actionsError) {
        // Fallback in case RPC is not yet applied to database
        console.warn("RPC 'get_distinct_log_actions' not found, falling back to sampling.");
        const { data: fallbackActions } = await supabase
          .from('logs')
          .select('action')
          .limit(2000);
        
        if (fallbackActions) {
          const uniqueActions = [...new Set(fallbackActions.map(a => a.action))].sort();
          setAvailableActions(uniqueActions);
        }
      }
    };
    fetchFilterData();
  }, []);

  // Novo Effect para inicializar datas: primeiro log até hoje
  useEffect(() => {
    const initializeDates = async () => {
      try {
        // Busca a data do primeiro log registrado
        const { data, error } = await supabase
          .from('logs')
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (data && !error) {
          const firstDate = format(new Date(data.created_at), 'yyyy-MM-dd');
          const today = format(new Date(), 'yyyy-MM-dd');
          setStartDate(firstDate);
          setEndDate(today);
        } else {
          // Fallback caso não existam logs ou dê erro
          const today = format(new Date(), 'yyyy-MM-dd');
          setStartDate(today);
          setEndDate(today);
        }
      } catch (err) {
        console.error("Erro ao inicializar datas:", err);
      }
    };
    initializeDates();
  }, []);

  const fetchLogs = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (debouncedSearchTerm) {
      query = query.or(`action.ilike.%${debouncedSearchTerm}%,user_email.ilike.%${debouncedSearchTerm}%`);
    }

    if (startDate) {
      const sd = new Date(startDate + 'T00:00:00');
      query = query.gte('created_at', sd.toISOString());
    }
    
    if (endDate) {
      const ed = new Date(endDate + 'T23:59:59.999');
      query = query.lte('created_at', ed.toISOString());
    }

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }

    if (userFilter !== 'all') {
      query = query.eq('user_id', userFilter);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao buscar logs', description: error.message, variant: 'destructive' });
      setLogs([]);
    } else {
      // Mapear nomes dos usuários manualmente para os logs buscados
      const logsWithNames = data.map(log => {
        const user = availableUsers.find(u => u.id === log.user_id);
        return {
          ...log,
          profiles: user ? { full_name: user.full_name } : null
        };
      });

      let filteredLogs = logsWithNames;
      if (debouncedSearchTerm) {
        const term = debouncedSearchTerm.toLowerCase();
        filteredLogs = logsWithNames.filter(log => 
          (log.profiles?.full_name?.toLowerCase().includes(term)) ||
          (log.action.toLowerCase().includes(term)) ||
          (log.user_email.toLowerCase().includes(term))
        );
      }

      setLogs(filteredLogs || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [toast, debouncedSearchTerm, currentPage, pageSize, empresa, startDate, endDate, actionFilter, userFilter]);

  useEffect(() => {
    if (empresa) {
        fetchLogs();
    }
  }, [fetchLogs, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize, startDate, endDate, actionFilter, userFilter]);

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setActionFilter('all');
    setUserFilter('all');
    setSearchTerm('');
  };

  const actionLabels = {
    'create_coleta': 'Cadastrou Coleta',
    'update_coleta': 'Atualizou Coleta',
    'delete_coleta_success': 'Excluiu Coleta',
    'delete_coleta_failed': 'Falha ao Excluir Coleta',
    'create_contrato': 'Cadastrou Contrato',
    'update_contrato': 'Atualizou Contrato',
    'delete_contract': 'Excluiu Contrato',
    'create_cliente': 'Cadastrou Cliente',
    'update_cliente': 'Atualizou Cliente',
    'delete_client_success': 'Excluiu Cliente',
    'create_fornecedor': 'Cadastrou Fornecedor',
    'update_fornecedor': 'Atualizou Fornecedor',
    'create_debito_success': 'Lançou Débito',
    'create_credito_success': 'Lançou Crédito',
    'delete_debito_entry': 'Excluiu Débito',
    'delete_credito_entry': 'Excluiu Crédito',
    'create_recibo_avulso': 'Gerou Recibo',
    'create_user_success': 'Cadastrou Usuário',
    'update_user_success': 'Atualizou Usuário',
    'delete_user_success': 'Excluiu Usuário',
    'create_stock_entry': 'Entrada de Estoque',
    'update_stock_entry': 'Atualizou Entrada',
    'delete_stock_entry': 'Excluiu Entrada',
    'create_stock_exit': 'Saída de Estoque',
    'update_stock_exit': 'Atualizou Saída',
    'delete_stock_exit': 'Excluiu Saída',
    'create_cost_center_success': 'Cadastrou C. Custo',
    'update_cost_center_success': 'Atualizou C. Custo',
    'delete_cost_center_success': 'Excluiu C. Custo',
    'register_payment_success': 'Registrou Pagamento',
    'delete_payment_success': 'Excluiu Pagamento',
    'create_certificado': 'Gerou Certificado',
    'update_certificado': 'Atualizou Certificado',
    'delete_certificate_success': 'Excluiu Certificado',
    'create_obra': 'Cadastrou Obra',
    'update_obra': 'Atualizou Obra',
    'delete_obra': 'Excluiu Obra',
    'obra_delete': 'Excluiu Obra',
    'obra_duplicate': 'Duplicou Obra',
    'create_visita': 'Registrou Visita',
    'update_visita': 'Atualizou Visita',
    'visita_create': 'Registrou Visita',
    'visita_update': 'Atualizou Visita',
    'visita_delete': 'Excluiu Visita',
    'visita_duplicate': 'Duplicou Visita',
    'create_produto': 'Cadastrou Produto',
    'update_produto': 'Atualizou Produto',
    'delete_produto_success': 'Excluiu Produto',
    'login_success': 'Login realizado',
    'login_failed': 'Falha no Login',
    'logout_success': 'Logout realizado',
    'change_password_success': 'Alterou Senha',
    'generate_receipt_success': 'Gerou Recibo Financeiro'
  };

  const renderDetails = (details) => {
    if (!details) return 'N/A';
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  };

  const getFriendlyAction = (action) => actionLabels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet>
        <title>Logs do Sistema - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <BookText className="w-8 h-8 text-emerald-400" /> Logs do Sistema
          </h1>
          <p className="text-emerald-200/80 mt-1">Visualize as atividades dos usuários no sistema.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10"
        >
          {/* Header com botão de mostrar/ocultar no mobile */}
          <div className="flex justify-between items-center mb-4 md:hidden">
            <h3 className="text-emerald-300 text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" /> Filtros
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 border-white/30 text-white hover:bg-white/10"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          <div className={`${isMobile && !showFilters ? 'hidden' : 'block'} space-y-4`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              {/* Buscar */}
              <div className="lg:col-span-4">
                <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm font-medium">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                  <Input
                    id="searchTerm"
                    type="search"
                    placeholder="Ação, e-mail ou nome..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/40 rounded-xl focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Usuário */}
              <div className="lg:col-span-3">
                <Label htmlFor="userFilter" className="block text-white mb-1 text-sm font-medium">Usuário</Label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger id="userFilter" className="bg-white/20 border-white/30 text-white rounded-xl">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-white/10 max-h-60 overflow-y-auto">
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {availableUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ação */}
              <div className="lg:col-span-3">
                <Label htmlFor="actionFilter" className="block text-white mb-1 text-sm font-medium">Ação</Label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger id="actionFilter" className="bg-white/20 border-white/30 text-white rounded-xl">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-white/10 max-h-80 overflow-y-auto">
                    <SelectItem value="all">Todas as ações</SelectItem>
                    {availableActions.map(action => (
                      <SelectItem key={action} value={action}>{getFriendlyAction(action)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data Inicial */}
              <div className="lg:col-span-1">
                <Label htmlFor="startDate" className="block text-white mb-1 text-sm font-medium">Início</Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate || ''}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white/20 border-white/30 text-white rounded-xl [color-scheme:dark] text-[10px] h-10 px-2"
                  />
                </div>
              </div>

              {/* Data Final */}
              <div className="lg:col-span-1">
                <Label htmlFor="endDate" className="block text-white mb-1 text-sm font-medium">Fim</Label>
                <div className="relative">
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate || ''}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white/20 border-white/30 text-white rounded-xl [color-scheme:dark] text-[10px] h-10 px-2"
                  />
                </div>
              </div>
            </div>

            {/* Botão Limpar (só aparece se houver filtros ativos) */}
            {(startDate || endDate || actionFilter !== 'all' || userFilter !== 'all' || searchTerm) && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-emerald-300 hover:text-emerald-400 text-xs gap-1"
                >
                  <X className="w-3 h-3" /> Limpar Filtros
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-lg">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-white/10 border-b-white/20 text-xs text-white/70">
                  <th className="p-3 text-left">Data</th>
                  <th className="p-3 text-left">Usuário</th>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">Ação</th>
                  <th className="p-3 text-left">Detalhes</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || !empresa ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-400" /></TableCell></TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5">
                    <TableCell data-label="Data" className="p-3">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</TableCell>
                    <TableCell data-label="Usuário" className="p-3 text-emerald-200/70">{log.user_email}</TableCell>
                    <TableCell data-label="Nome" className="p-3 font-medium">{log.profiles?.full_name || '-'}</TableCell>
                    <TableCell data-label="Ação" className="p-3">
                      <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md text-[10px] uppercase font-bold whitespace-nowrap">
                        {getFriendlyAction(log.action)}
                      </span>
                    </TableCell>
                    <TableCell data-label="Detalhes" className="p-3 text-[10px] max-w-sm">
                      <div className="max-h-16 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-1">
                        {renderDetails(log.details)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-gray-400">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
        
        {totalCount > 0 && (
          <div className="flex flex-col md:flex-row justify-between items-center bg-white/5 p-4 rounded-xl gap-4">
            <div className="text-emerald-200/60 text-sm font-medium">
              Exibindo <span className="text-emerald-300">{((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)}</span> de <span className="text-emerald-300">{totalCount}</span> registros
            </div>
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                totalCount={totalCount}
            />
          </div>
        )}

      </div>
    </>
  );
};

export default LogsPage;