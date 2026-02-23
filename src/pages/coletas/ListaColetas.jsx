import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
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
  const { toast } = useToast();

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  // ✅ CORREÇÃO: Usar profile do ProfileContext ao invés de buscar separadamente
  const userRole = useMemo(() => profile?.role || null, [profile]);
  const userId = useMemo(() => profile?.id || profile?.userId || null, [profile]);

  // CORREÇÃO: Buscar dados da empresa para todos os usuários
  useEffect(() => {
    const fetchEmpresaData = async () => {
      try {
        const { data, error } = await supabase.from('empresa').select('*').single();

        if (error) {
          console.warn("Usando configuração padrão para empresa");
          // Não mostra erro para o usuário, usa fallback silenciosamente
        }

        const empresaData = data || {
          items_per_page: 25,
          timezone: 'America/Sao_Paulo',
          nome_fantasia: 'Nome da Empresa',
          razao_social: 'Razão Social da Empresa',
          cnpj: 'N/A',
          telefone: '',
          email: '',
          endereco: '',
          municipio: '',
          estado: '',
          logo_documento_url: null
        };
        setEmpresa(empresaData);

        // Inicializa datas com o timezone correto se for o primeiro load
        if (!startDate) {
          setStartDate(format(getZonedStartOfMonth(empresaData.timezone), 'yyyy-MM-dd'));
        }
        if (!endDate) {
          setEndDate(format(getZonedEndOfMonth(empresaData.timezone), 'yyyy-MM-dd'));
        }

      } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        // Fallback seguro
        setEmpresa({
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
      }
    };

    fetchEmpresaData();
  }, []);

  // ✅ CORREÇÃO: Função otimizada para buscar totais APENAS da get_coletas_totals
  const fetchPeriodTotals = useCallback(async () => {
    if (profileLoading || !profile || !empresa || !userRole) return;

    console.log('🔄 Buscando totais do período via get_coletas_totals...', {
      startDate: debouncedStartDate,
      endDate: debouncedEndDate,
      coletaSearch: debouncedColetaSearchTerm,
      clientSearch: debouncedClientSearchTerm,
      userRole: userRole,
      userId: userId
    });

    try {
      // ✅ CORREÇÃO: Preparar parâmetros
      // Verificar se o termo de busca contém apenas números
      const isNumericSearch = debouncedColetaSearchTerm && /^\d+$/.test(debouncedColetaSearchTerm.trim());

      const params = {
        p_start_date: debouncedStartDate || null,
        p_end_date: debouncedEndDate || null,
        p_cliente_id: null,
        // Só passa o numero_coleta_term se for numérico, senão passa null
        p_numero_coleta_term: isNumericSearch ? debouncedColetaSearchTerm : null,
        // Se não for numérico, usa o termo de busca no nome do cliente
        p_cliente_name_term: debouncedClientSearchTerm || (isNumericSearch ? null : debouncedColetaSearchTerm) || null,
      };

      // ✅ CORREÇÃO: Só adiciona user_id se for coletor E tiver userId
      if (userRole === 'coletor' && userId) {
        params.p_user_id = userId;
        console.log('🎯 Adicionando filtro por user_id para coletor:', userId);
      } else {
        params.p_user_id = null;
        console.log('👑 Sem filtro de usuário - visualizando todas as coletas');
      }

      console.log('📤 Parâmetros enviados para get_coletas_totals:', params);

      const { data, error } = await supabase.rpc('get_coletas_totals', params);

      if (error) {
        console.error("❌ Erro ao buscar totais do período:", error);
        toast({
          title: 'Erro ao carregar totais',
          description: error.message,
          variant: 'destructive'
        });
        setPeriodTotals({ coletado: 0, compras: 0, entregue: 0 });
      } else {
        console.log('✅ Totais recebidos da get_coletas_totals:', data);

        // ✅ CORREÇÃO CRÍTICA: A função retorna um ARRAY com um objeto
        // data = [{ total_coletado: 188, total_compras: 0, total_entregue: 30 }]
        const totalsData = data && data.length > 0 ? data[0] : {};

        console.log('📊 Dados extraídos do array:', totalsData);

        setPeriodTotals({
          coletado: parseFloat(totalsData?.total_coletado || 0),
          compras: parseFloat(totalsData?.total_compras || 0),
          entregue: parseFloat(totalsData?.total_entregue || 0),
        });
      }
    } catch (catchError) {
      console.error("❌ Erro inesperado ao buscar totais:", catchError);
      setPeriodTotals({ coletado: 0, compras: 0, entregue: 0 });
    }
  }, [profile, profileLoading, empresa, debouncedStartDate, debouncedEndDate, debouncedColetaSearchTerm, debouncedClientSearchTerm, userRole, userId, toast]);

  const fetchColetas = useCallback(async () => {
    // ✅ CORREÇÃO: Não buscar até ter o role definido
    if (profileLoading || !profile || !empresa || !userRole) {
      console.log('⏳ Aguardando definição do role para coletas...', { userRole });
      return;
    }

    setLoading(true);

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    console.log('🔍 Fetching coletas - Role:', userRole, 'UserID:', userId);

    let query = supabase.from('v_coletas_com_status').select('*', { count: 'exact' });

    // ✅ NOVO: Aplicar filtro por user_id apenas para coletores
    if (userRole === 'coletor' && userId) {
      query = query.eq('user_id', userId);
      console.log('🎯 Aplicando filtro por user_id para coletor:', userId);
    } else if (userRole === 'administrador' || userRole === 'gerente') {
      console.log('👑 Visualizando TODAS as coletas - Perfil:', userRole);
      // Não aplica filtro - vê todas as coletas
    } else {
      console.log('⚠️ Perfil não reconhecido:', userRole);
    }

    if (debouncedColetaSearchTerm) {
      const searchTerm = debouncedColetaSearchTerm.trim();
      const escapedSearchTerm = escapePostgrestLikePattern(searchTerm);
      // Verificar se o termo de busca contém apenas números
      const isNumericSearch = /^\d+$/.test(searchTerm);

      if (isNumericSearch) {
        // Se for numérico, busca exata no numero_coleta primeiro
        const numeroColeta = parseInt(searchTerm, 10);
        // Usa filtro de igualdade no numero_coleta (busca exata)
        query = query.eq('numero_coleta', numeroColeta);
      } else {
        // Se contiver letras, busca apenas nos nomes dos clientes
        query = query.or(`razao_social.ilike.%${escapedSearchTerm}%,nome_fantasia.ilike.%${escapedSearchTerm}%`);
      }
    } else {
      if (debouncedClientSearchTerm) {
        const escapedClientSearchTerm = escapePostgrestLikePattern(debouncedClientSearchTerm);
        query = query.or(`razao_social.ilike.%${escapedClientSearchTerm}%,nome_fantasia.ilike.%${escapedClientSearchTerm}%`);
      }
      if (debouncedStartDate) {
        query = query.gte('data_coleta', debouncedStartDate);
      }
      if (debouncedEndDate) {
        const endOfDayDate = format(endOfDay(parseISO(debouncedEndDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
        query = query.lte('data_coleta', endOfDayDate);
      }
    }

    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar coletas', description: error.message, variant: 'destructive' });
      setColetas([]);
      setTotalCount(0);
    } else {
      console.log('✅ Coletas encontradas:', data?.length, 'Perfil:', userRole);
      setColetas(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [profile, profileLoading, sortConfig, debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate, empresa, toast, currentPage, pageSize, userRole, userId]);

  const refreshColetasData = useCallback(async () => {
    await fetchColetas();
    await fetchPeriodTotals(); // ✅ Buscar totais também ao recarregar
  }, [fetchColetas, fetchPeriodTotals]);

  // ✅ CORREÇÃO CRÍTICA: Recarregar coletas quando userRole ou userId mudar
  useEffect(() => {
    console.log('🔄 Trigger: userRole ou userId mudou para coletas', { userRole, userId });
    if (userRole) {
      setCurrentPage(1); // Resetar para primeira página
      refreshColetasData();
    }
  }, [userRole, userId, refreshColetasData]);

  // ✅ CORREÇÃO: Buscar dados quando os filtros mudarem
  useEffect(() => {
    if (userRole) {
      refreshColetasData();
    }
  }, [refreshColetasData, userRole]);

  // ✅ CORREÇÃO: Buscar totais quando os filtros de data mudarem
  useEffect(() => {
    if (userRole) {
      fetchPeriodTotals();
    }
  }, [debouncedStartDate, debouncedEndDate, fetchPeriodTotals, userRole]);

  useEffect(() => {
    setCurrentPage(1);
    if (coletaSearchTerm) {
      setClientSearchTerm('');
    }
  }, [debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate, pageSize, coletaSearchTerm]);

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
              {(userRole === 'administrador' || userRole === 'gerente') && (
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