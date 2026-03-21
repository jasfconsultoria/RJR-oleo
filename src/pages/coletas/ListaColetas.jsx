import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import ColetasFilters from '@/components/coletas/ColetasFilters';
import ColetasTable from '@/components/coletas/ColetasTable';
import { startOfMonth, format, endOfDay, parseISO, endOfMonth } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { ReciboViewDialog } from '@/components/coletas/ReciboViewDialog';
import { escapePostgrestLikePattern, getZonedStartOfMonth, getZonedEndOfMonth } from '@/lib/utils';

const ListaColetas = () => {
  const [coletas, setColetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coletaSearchTerm, setColetaSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [tipoColeta, setTipoColeta] = useState(''); // Novo filtro
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get('clienteId');

  const [sortConfig, setSortConfig] = useState({ key: 'numero_coleta', direction: 'desc' });
  const { profile, loading: profileLoading } = useProfile();

  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [selectedColeta, setSelectedColeta] = useState(null);
  const [empresa, setEmpresa] = useState({
    items_per_page: 25,
    timezone: 'America/Sao_Paulo',
    nome_fantasia: 'Nome da Empresa',
    razao_social: 'Razão Social da Empresa',
    cnpj: 'N/A',
    telefone: '',
    email: '',
    endereco: '',
    logo_documento_url: null
  });

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [periodTotals, setPeriodTotals] = useState({ coletado: 0, compras: 0, entregue: 0 });

  const debouncedColetaSearchTerm = useDebounce(coletaSearchTerm, 500);
  const debouncedClientSearchTerm = useDebounce(clientSearchTerm, 500);
  const debouncedStartDate = useDebounce(startDate, 500);
  const debouncedEndDate = useDebounce(endDate, 500);
  const debouncedTipoColeta = useDebounce(tipoColeta, 500); // Novo debounce
  const { toast } = useToast();

  const pageSize = useMemo(() => Number(empresa?.items_per_page || 25), [empresa]);

  // ✅ CORREÇÃO: Usar profile do ProfileContext ao invés de buscar separadamente
  const userRole = useMemo(() => profile?.role || null, [profile]);
  const userId = useMemo(() => profile?.id || profile?.userId || null, [profile]);

  // 1. Fetch dados da empresa e inicialização de datas
  useEffect(() => {
    const initPage = async () => {
      try {
        const { data: empresaData, error } = await supabase.from('empresa').select('*').single();

        const config = empresaData || {
          items_per_page: 25,
          timezone: 'America/Sao_Paulo'
        };

        setEmpresa(config);

        // Inicializa datas com o timezone correto de forma atômica
        if (!startDate && !endDate) {
          const start = format(getZonedStartOfMonth(config.timezone), 'yyyy-MM-dd');
          const end = format(getZonedEndOfMonth(config.timezone), 'yyyy-MM-dd');
          setStartDate(start);
          setEndDate(end);
        }
      } catch (err) {
        console.warn("Erro ao inicializar página, usando padrões.");
      }
    };
    initPage();
  }, []);

  // 2. Funções de busca com useCallback
  const fetchPeriodTotals = useCallback(async () => {
    if (profileLoading || !profile || !empresa?.timezone || !userRole) return;

    try {
      const isNumericSearch = debouncedColetaSearchTerm && /^\d+$/.test(debouncedColetaSearchTerm.trim());
      const params = {
        p_start_date: debouncedStartDate || null,
        p_end_date: debouncedEndDate || null,
        p_cliente_id: clienteId || null,
        p_numero_coleta_term: isNumericSearch ? debouncedColetaSearchTerm : null,
        p_cliente_name_term: debouncedClientSearchTerm || (isNumericSearch ? null : debouncedColetaSearchTerm) || null,
        p_user_id: (userRole === 'coletor' && userId) ? userId : null
      };

      const { data, error } = await supabase.rpc('get_coletas_totals', params);
      if (!error && data && data.length > 0) {
        setPeriodTotals({
          coletado: parseFloat(data[0]?.total_coletado || 0),
          compras: parseFloat(data[0]?.total_compras || 0),
          entregue: parseFloat(data[0]?.total_entregue || 0),
        });
      }
    } catch (err) {
      console.error("Erro ao buscar totais:", err);
    }
  }, [profileLoading, profile, empresa, userRole, userId, clienteId, debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate]);

  const fetchColetas = useCallback(async (isCurrent = { active: true }) => {
    if (profileLoading || !profile || !empresa?.timezone || !userRole || !debouncedStartDate || !debouncedEndDate) {
      return;
    }
    if (!isCurrent.active) return;

    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = supabase.from('v_coletas_com_status').select('*', { count: 'exact' });

      if (userRole === 'coletor' && userId) {
        query = query.eq('user_id', userId);
      }

      if (clienteId) {
        query = query.eq('cliente_id', clienteId);
      }

      if (debouncedColetaSearchTerm) {
        const searchTerm = debouncedColetaSearchTerm.trim();
        const isNumericSearch = /^\d+$/.test(searchTerm);
        if (isNumericSearch) {
          query = query.eq('numero_coleta', parseInt(searchTerm, 10));
        } else {
          const escaped = escapePostgrestLikePattern(searchTerm);
          query = query.or(`razao_social.ilike.%${escaped}%,nome_fantasia.ilike.%${escaped}%`);
        }
      } else {
        if (debouncedClientSearchTerm) {
          const escaped = escapePostgrestLikePattern(debouncedClientSearchTerm);
          query = query.or(`razao_social.ilike.%${escaped}%,nome_fantasia.ilike.%${escaped}%`);
        }
        if (debouncedStartDate) query = query.gte('data_coleta', debouncedStartDate);
        if (debouncedEndDate) {
          const endOfDayDate = format(endOfDay(parseISO(debouncedEndDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
          query = query.lte('data_coleta', endOfDayDate);
        }
        if (debouncedTipoColeta) {
          query = query.eq('tipo_coleta', debouncedTipoColeta);
        }
      }

      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

      const { data, error, count } = await query;

      if (!isCurrent.active) return; // Check again before setting state

      if (error) {
        console.error("❌ Erro ao buscar coletas:", error);
        toast({ title: 'Erro ao buscar coletas', description: error.message, variant: 'destructive' });
      } else {
        setColetas(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error("Erro ao buscar coletas:", err);
    } finally {
      if (isCurrent.active) { // Only set loading to false if still active
        setLoading(false);
      }
    }
  }, [profileLoading, profile, empresa, userRole, userId, clienteId, debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate, debouncedTipoColeta, currentPage, pageSize, sortConfig, toast]);

  // 3. Effect ÚNICO para disparar buscas baseadas em mudanças de filtro/perfil
  // Isso unifica o carregamento e evita as "piscadas" por triggers múltiplos
  useEffect(() => {
    const isCurrent = { active: true };
    if (userRole && debouncedStartDate && debouncedEndDate) {
      fetchColetas(isCurrent);
      fetchPeriodTotals();
    }
    return () => { isCurrent.active = false; };
  }, [fetchColetas, fetchPeriodTotals, userRole, debouncedStartDate, debouncedEndDate, debouncedTipoColeta]);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
    if (coletaSearchTerm) setClientSearchTerm('');
  }, [debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate, debouncedTipoColeta, pageSize, coletaSearchTerm]);

  const refreshColetasData = useCallback(async () => {
    await Promise.all([fetchColetas(), fetchPeriodTotals()]);
  }, [fetchColetas, fetchPeriodTotals]);

  // NOVO: Buscar nome do cliente para feedback visual no filtro
  useEffect(() => {
    if (clienteId) {
      const fetchClientName = async () => {
        const { data, error } = await supabase
          .from('clientes')
          .select('nome_fantasia, razao_social')
          .eq('id', clienteId)
          .single();
        if (data && !error) {
          setClientSearchTerm(data.nome_fantasia || data.razao_social);
        }
      };
      fetchClientName();
    }
  }, [clienteId]);

  const handleDelete = async (coletaId) => {
    const coletaToDelete = coletas.find(c => c.id === coletaId);
    if (!coletaToDelete) return;

    const { error } = await supabase.from('coletas').delete().eq('id', coletaId);

    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      await logAction('delete_coleta_failed', { error: error.message, coleta_id: coletaId, numero_coleta: coletaToDelete.numero_coleta });
    } else {
      toast({ title: 'Coleta excluída!', description: 'A coleta foi removida com sucesso.' });
      await logAction('delete_coleta_success', { coleta_id: coletaId, numero_coleta: coletaToDelete.numero_coleta });
      refreshColetasData();
    }
  };

  const handleReciboAction = async (coletaId) => {
    const coleta = coletas.find(c => c.id === coletaId);
    if (coleta) {
      setSelectedColeta({ ...coleta, assinatura_url: coleta.assinatura_url });
      setReciboModalOpen(true);
    }
  };

  const formatClienteDisplay = (coleta) => {
    const nomeFantasia = coleta.nome_fantasia || '';
    const razaoSocial = coleta.razao_social || '';

    if (nomeFantasia && razaoSocial) {
      return `${nomeFantasia} - ${razaoSocial}`;
    }
    return nomeFantasia || razaoSocial || '';
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    const sortKeyMap = {
      'cliente_display': 'razao_social',
    };

    const actualKey = sortKeyMap[key] || key;

    setSortConfig({ key: actualKey, direction });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // ✅ CORREÇÃO: Loading específico para carregamento do perfil
  if (profileLoading || !userRole) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        <span className="ml-2 text-white">Carregando perfil...</span>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Lista de Coletas - Sistema RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <FileText className="w-8 h-8 text-emerald-400" /> Lista de Coletas
              {/* ✅ NOVO: Indicador de visualização */}
              {userRole === 'coletor' && (
                <span className="text-sm text-emerald-300 bg-emerald-800/30 px-2 py-1 rounded-lg">
                  Minhas Coletas
                </span>
              )}
              {['administrador', 'gerente', 'super_admin'].includes(userRole) && (
                <span className="text-sm text-blue-300 bg-blue-800/30 px-2 py-1 rounded-lg">
                  Todas as Coletas
                </span>
              )}
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize e gerencie as coletas realizadas.</p>
          </div>
          <Link to="/app/coletas/nova" className='w-full sm:w-auto'>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Coleta
            </Button>
          </Link>
        </motion.div>

        <ColetasFilters
          coletaSearchTerm={coletaSearchTerm}
          setColetaSearchTerm={setColetaSearchTerm}
          clientSearchTerm={clientSearchTerm}
          setClientSearchTerm={setClientSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          tipoColeta={tipoColeta}
          setTipoColeta={setTipoColeta}
        />

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <ColetasTable
            coletas={coletas.map(coleta => ({
              ...coleta,
              cliente_display: formatClienteDisplay(coleta)
            }))}
            sortConfig={sortConfig}
            requestSort={requestSort}
            handleOpenRecibo={handleReciboAction}
            handleDelete={handleDelete}
            totals={periodTotals}
            timezone={empresa?.timezone}
            loading={loading}
            // ✅ NOVO: Passar informações do perfil para a tabela
            userRole={userRole}
          />
        </motion.div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />

        {reciboModalOpen && selectedColeta && (
          <ReciboViewDialog
            coleta={selectedColeta}
            empresa={empresa}
            isOpen={reciboModalOpen}
            onClose={() => {
              setReciboModalOpen(false);
              setTimeout(() => {
                refreshColetasData();
              }, 1000);
            }}
          />
        )}
      </div>
    </>
  );
};

export default ListaColetas;