import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Truck, Droplets, MapPin, User, LayoutDashboard, Users, Calendar, Eraser, Filter, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatNumber, getZonedNow, getZonedStartOfMonth, formatDateWithTimezone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useLocationData } from '@/hooks/useLocationData';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { UserSearchableSelect } from '@/components/ui/UserSearchableSelect';
import { format, endOfDay, parseISO } from 'date-fns';

// Função para formatar data como YYYY-MM-DD
const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

// Função para obter datas padrão do mês atual
const getDefaultMonthDates = (timezone = 'America/Sao_Paulo') => {
  const now = getZonedNow(timezone);
  const firstDay = getZonedStartOfMonth(timezone);
  // Final é a data atual no fuso da empresa
  const endDay = now;

  return {
    start: format(firstDay, 'yyyy-MM-dd'),
    end: format(endDay, 'yyyy-MM-dd')
  };
};

const DashboardPage = () => {
  const defaultDates = getDefaultMonthDates();
  const [stats, setStats] = useState({
    totalColetas: 0,
    totalMassa: 0,
    coletasPorEstado: [],
    coletasPorMunicipio: [],
    coletasPorColetor: [],
    coletasPorCliente: [],
  });
  const { loading: profileLoading, profile } = useProfile();
  const { user } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const { toast } = useToast();
  const [periodoFiltro, setPeriodoFiltro] = useState('personalizado'); // Default: período personalizado
  const [dataInicio, setDataInicio] = useState(defaultDates.start);
  const [dataFim, setDataFim] = useState(defaultDates.end);
  const [dataInicioInput, setDataInicioInput] = useState(defaultDates.start); // Estado local para o input
  const [dataFimInput, setDataFimInput] = useState(defaultDates.end); // Estado local para o input
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroMunicipio, setFiltroMunicipio] = useState('todos');
  const [filtroColetor, setFiltroColetor] = useState('all');
  const [municipiosFiltro, setMunicipiosFiltro] = useState([]);
  const [estadosFiltro, setEstadosFiltro] = useState([]);
  const [municipioMapResolved, setMunicipioMapResolved] = useState({});
  const [coletores, setColetores] = useState([]);
  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');

  // Buscar estados e municípios
  const { estados, fetchMunicipios, fetchMunicipiosByCodes } = useLocationData();

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Os estados de data agora são inicializados diretamente para evitar buscas sem filtro

  // Buscar estados e municípios únicos que possuem coletas
  useEffect(() => {
    const loadGeoFilters = async () => {
      try {
        // Buscar estados únicos das coletas
        let query = supabase.from('coletas').select('estado, municipio');

        // Se for coletor, filtrar apenas as dele
        if (profile?.role === 'coletor') {
          query = query.eq('user_id', user.id);
        }

        const { data: coletasLocais, error } = await query;
        if (error) throw error;

        // Extrair estados únicos
        const uniqueEstados = [...new Set(coletasLocais.map(c => c.estado).filter(Boolean))].sort();
        setEstadosFiltro(uniqueEstados);

        // Extrair municípios únicos e resolver nomes se forem códigos
        const uniqueMunicipioCodes = [...new Set(coletasLocais.map(c => c.municipio).filter(Boolean))];
        const solvedMunicipios = await fetchMunicipiosByCodes(uniqueMunicipioCodes);
        setMunicipioMapResolved(solvedMunicipios);

        // Atualizar lista de municípios baseada no estado selecionado
        let filteredMunicipios = coletasLocais;
        if (filtroEstado !== 'todos') {
          filteredMunicipios = filteredMunicipios.filter(c => c.estado === filtroEstado);
        }

        const uniqueVals = [...new Set(filteredMunicipios.map(c => c.municipio).filter(Boolean))];
        const muniList = uniqueVals.map(val => {
          const label = !isNaN(val) && solvedMunicipios[val] ? solvedMunicipios[val] : val;
          return { value: val, label: label };
        }).sort((a, b) => a.label.localeCompare(b.label));

        setMunicipiosFiltro(muniList);
      } catch (err) {
        console.error('Erro ao carregar filtros geográficos:', err);
      }
    };

    if (profile) {
      loadGeoFilters();
    }
  }, [profile, filtroEstado, fetchMunicipiosByCodes, user.id]);

  // Buscar lista de coletores
  useEffect(() => {
    const fetchColetores = async () => {
      if (!['administrador', 'super_admin'].includes(profile?.role)) {
        setColetores([]);
        return;
      }

      try {
        console.log('🔍 Buscando coletores...');

        // Tentar usar a função RPC primeiro
        const { data: usuariosRPC, error: rpcError } = await supabase.rpc('get_all_users');

        if (!rpcError && usuariosRPC) {
          console.log('✅ Usuários encontrados via RPC:', usuariosRPC.length);
          // Filtrar apenas coletores
          const coletoresFiltrados = usuariosRPC;
          console.log('✅ Usuários encontrados via RPC:', coletoresFiltrados.length);

          const sortedColetores = coletoresFiltrados.sort((a, b) => {
            if (!a.full_name) return 1;
            if (!b.full_name) return -1;
            return a.full_name.localeCompare(b.full_name);
          });

          setColetores(sortedColetores);
          return;
        }

        // Fallback: buscar diretamente da tabela profiles
        console.log('⚠️ RPC não disponível, buscando diretamente de profiles...');
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('❌ Erro ao buscar coletores de profiles:', error);
          throw error;
        }

        console.log('✅ Coletores encontrados em profiles:', data?.length);
        console.log('📋 Dados dos coletores:', data);

        const sortedColetores = (data || []).sort((a, b) => {
          if (!a.full_name) return 1;
          if (!b.full_name) return -1;
          return a.full_name.localeCompare(b.full_name);
        });

        setColetores(sortedColetores);
      } catch (error) {
        console.error('❌ Erro ao buscar coletores:', error);
        setColetores([]);
      }
    };

    fetchColetores();
  }, [profile]);

  // Função para obter o user_id correto
  const getUserId = () => {
    if (user?.id) return user.id;
    if (profile?.id) return profile.id;
    return null;
  };

  // Buscar configurações da empresa para obter o timezone
  useEffect(() => {
    const fetchEmpresaConfig = async () => {
      try {
        const { data, error } = await supabase.from('empresa').select('timezone').single();
        if (!error && data?.timezone) {
          setEmpresaTimezone(data.timezone);

          // Re-inicializar datas com o timezone correto se for o primeiro load
          const zonedDefaults = getDefaultMonthDates(data.timezone);
          setDataInicio(zonedDefaults.start);
          setDataFim(zonedDefaults.end);
          setDataInicioInput(zonedDefaults.start);
          setDataFimInput(zonedDefaults.end);
        }
      } catch (err) {
        console.error('Erro ao buscar timezone da empresa:', err);
      }
    };
    fetchEmpresaConfig();
  }, []);

  // Função para obter datas baseadas no período selecionado
  const getDateRange = (periodo) => {
    const now = getZonedNow(empresaTimezone);
    const start = getZonedNow(empresaTimezone);

    switch (periodo) {
      case 'semana':
        start.setDate(now.getDate() - 7);
        break;
      case 'quinzena':
        start.setDate(now.getDate() - 15);
        break;
      case 'mes':
        const firstDay = getZonedStartOfMonth(empresaTimezone);
        const lastDay = getZonedNow(empresaTimezone);
        return {
          start: format(firstDay, 'yyyy-MM-dd'),
          end: format(lastDay, 'yyyy-MM-dd')
        };
      case 'bimestre':
        start.setMonth(now.getMonth() - 2);
        break;
      case 'trimestre':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'semestre':
        start.setMonth(now.getMonth() - 6);
        break;
      case 'ano':
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'personalizado':
      default:
        return { start: null, end: null };
    }

    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(now, 'yyyy-MM-dd')
    };
  };

  // Buscar municípios e estados da tabela clientes
  const fetchMunicipiosEstados = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('municipio, estado')
        .not('municipio', 'is', null)
        .not('estado', 'is', null);

      if (error) throw error;

      const municipioEstadoMap = {};
      data?.forEach(cliente => {
        if (cliente.municipio && cliente.estado) {
          municipioEstadoMap[cliente.municipio] = cliente.estado;
        }
      });

      return municipioEstadoMap;
    } catch (error) {
      console.error('Erro ao buscar municípios:', error);
      return {};
    }
  };

  // Buscar informações dos usuários (coletores) - VERSÃO CORRIGIDA
  // Busca informações dos usuários da tabela profiles (fonte da verdade)
  const fetchUsuariosInfo = async (userIds) => {
    try {
      console.log('🔍 Buscando informações dos usuários com IDs:', userIds);

      if (!userIds || userIds.length === 0) {
        console.log('⚠️ Nenhum user_id fornecido para busca');
        return [];
      }

      // 1. Buscar da tabela profiles com as colunas corretas
      // Garantir que todos os IDs sejam UUIDs válidos
      const validUserIds = userIds.filter(id => id && id !== 'null' && id !== 'undefined');

      if (validUserIds.length === 0) {
        console.warn('⚠️ Nenhum ID válido fornecido');
        return [];
      }

      console.log('🔍 Buscando perfis para IDs:', validUserIds);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, role, estado, municipio')
        .in('id', validUserIds);

      if (profilesError) {
        console.error('❌ Erro ao buscar perfis:', profilesError);
      }

      console.log('✅ Perfis encontrados:', profilesData?.length);
      console.log('📋 Dados dos perfis:', profilesData);

      // 2. Criar um mapa para busca rápida (normalizando IDs como string)
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(String(profile.id), profile);
      });

      // 3. Identificar quais usuários não foram encontrados
      const usuariosNaoEncontrados = validUserIds.filter(id => !profilesMap.has(String(id)));

      if (usuariosNaoEncontrados.length > 0) {
        console.warn('⚠️ Usuários não encontrados em profiles:', usuariosNaoEncontrados);
        console.warn('💡 Dica: Execute a migração 2073 para sincronizar usuários de auth.users para profiles');
      }

      // 4. Combinar dados de profiles
      const result = validUserIds.map(userId => {
        // Buscar em profiles usando o mapa (mais eficiente)
        const usuario = profilesMap.get(String(userId));

        // Determinar nome final
        let nomeFinal = usuario?.full_name;

        // Se não encontrou ou full_name está vazio, usar fallback
        if (!usuario || !nomeFinal || nomeFinal.trim() === '') {
          if (!usuario) {
            console.warn(`⚠️ Usuário ${userId} não está na tabela profiles`);
          } else if (!nomeFinal || nomeFinal.trim() === '') {
            console.warn(`⚠️ Usuário ${userId} encontrado mas sem full_name`);
          }

          // Usar fallback com ID
          nomeFinal = `Coletor ${String(userId).substring(0, 8)}`;
        }

        console.log('✅ Usuário processado:', {
          userId,
          nomeFinal,
          role: usuario?.role || 'coletor'
        });

        return {
          id: userId,
          full_name: nomeFinal,
          role: usuario?.role || 'coletor',
          estado: usuario?.estado || null,
          municipio: usuario?.municipio || null
        };
      });

      console.log('📊 Resultado final dos usuários:', result);
      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar informações dos usuários:', error);
      // Fallback final
      return userIds.map(id => ({
        id: id,
        full_name: `Coletor ${String(id).substring(0, 8)}`
      }));
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchDashboardData = async () => {
      const userId = getUserId();

      if (!userId || !profile) {
        console.warn('❌ User ID ou Profile não encontrado:', { user, profile });
        setDataLoading(false);
        return;
      }

      setDataLoading(true);

      try {
        console.log('🔄 Iniciando busca de dados para:', {
          userId,
          role: profile.role,
          periodo: periodoFiltro,
          dataInicio,
          dataFim
        });

        // Obter range de datas
        let dateRange = {};
        if (periodoFiltro !== 'personalizado') {
          dateRange = getDateRange(periodoFiltro);
          if (dateRange.start && dateRange.end) {
            setDataInicio(dateRange.start);
            setDataFim(dateRange.end);
          }
        } else if (dataInicio && dataFim) {
          dateRange = { start: dataInicio, end: dataFim };
        }

        console.log('📅 Range de datas:', dateRange);

        // Buscar mapeamento de municípios para estados
        const municipioEstadoMap = await fetchMunicipiosEstados();
        console.log('🗺️ Mapeamento município->estado:', municipioEstadoMap);

        let estadoData = [];
        let municipioData = [];
        let coletorData = [];
        let clienteData = [];

        // Construir query base
        let coletasQuery = supabase.from('coletas').select('*');

        // Aplicar filtro de período se existir
        if (dateRange.start && dateRange.end) {
          const endOfDayISO = format(endOfDay(parseISO(dateRange.end)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
          coletasQuery = coletasQuery
            .gte('data_coleta', dateRange.start)
            .lte('data_coleta', endOfDayISO);
        }

        // Aplicar filtros de estado, município e coletor
        if (filtroEstado && filtroEstado !== 'todos') {
          coletasQuery = coletasQuery.eq('estado', filtroEstado);
        }

        if (filtroMunicipio && filtroMunicipio !== 'todos') {
          coletasQuery = coletasQuery.eq('municipio', filtroMunicipio);
        }

        if (filtroColetor && filtroColetor !== 'all') {
          coletasQuery = coletasQuery.eq('user_id', filtroColetor);
        }

        if (['administrador', 'super_admin'].includes(profile.role)) {
          console.log('👑 Buscando dados como administrador/super_admin...');

          const { data: todasColetas, error: coletasError } = await coletasQuery;

          if (coletasError) {
            console.error('❌ Erro ao buscar coletas:', coletasError);
            throw coletasError;
          }

          console.log('📋 Total de coletas encontradas:', todasColetas?.length);

          if (todasColetas && todasColetas.length > 0) {
            // Resolver nomes dos municípios para os gráficos (Admin)
            const uniqueCodes = [...new Set(todasColetas.map(c => c.municipio).filter(Boolean))];
            const resolvedNames = await fetchMunicipiosByCodes(uniqueCodes);

            // Processar dados por estado
            const estadoMap = {};
            const municipioMap = {};

            todasColetas.forEach(coleta => {
              const municipio = coleta.municipio || 'Não informado';
              const estado = coleta.estado || municipioEstadoMap[municipio] || 'Estado não identificado';

              if (!estadoMap[estado]) {
                estadoMap[estado] = { coletas: 0, massa: 0 };
              }
              estadoMap[estado].coletas += 1;
              estadoMap[estado].massa += parseFloat(coleta.quantidade_coletada) || 0;

              if (!municipioMap[municipio]) {
                municipioMap[municipio] = { coletas: 0, massa: 0, estado: estado };
              }
              municipioMap[municipio].coletas += 1;
              municipioMap[municipio].massa += parseFloat(coleta.quantidade_coletada) || 0;
            });

            estadoData = Object.entries(estadoMap)
              .map(([estado, dados]) => ({
                local: estado,
                coletas: dados.coletas,
                massa: parseFloat(dados.massa.toFixed(2))
              }))
              .sort((a, b) => b.coletas - a.coletas);

            municipioData = Object.entries(municipioMap)
              .map(([municipio, dados]) => {
                const nomeMunicipio = !isNaN(municipio) && resolvedNames[municipio]
                  ? resolvedNames[municipio]
                  : municipio;
                return {
                  local: `${nomeMunicipio} - ${dados.estado}`,
                  coletas: dados.coletas,
                  massa: parseFloat(dados.massa.toFixed(2))
                };
              })
              .sort((a, b) => b.coletas - a.coletas)
              .slice(0, 10);

            console.log('📈 Dados por estado processados:', estadoData);
            console.log('🏙️ Dados por município processados:', municipioData);

            // Dados por coletor
            const coletorMap = {};
            todasColetas.forEach(coleta => {
              const userId = coleta.user_id;
              if (!coletorMap[userId]) {
                coletorMap[userId] = { coletas: 0, massa: 0, user_id: userId };
              }
              coletorMap[userId].coletas += 1;
              coletorMap[userId].massa += parseFloat(coleta.quantidade_coletada) || 0;
            });

            console.log('👥 Map de coletores:', Object.keys(coletorMap).length);

            // Buscar informações dos usuários (coletores)
            const userIds = Object.keys(coletorMap);
            if (userIds.length > 0) {
              const usuarios = await fetchUsuariosInfo(userIds);
              console.log('👤 Usuários encontrados:', usuarios?.length);
              console.log('👤 Array de usuários retornado:', usuarios);

              // Combinar dados - USANDO FULL_NAME
              coletorData = Object.values(coletorMap).map(coletor => {
                // Garantir comparação correta de IDs convertendo ambos para string
                const usuario = usuarios?.find(u => String(u.id) === String(coletor.user_id));

                // Usar full_name da tabela profiles, com fallback
                let nomeColetor = usuario?.full_name;

                // Se não tem nome ou está vazio, usar fallback
                if (!nomeColetor || nomeColetor.trim() === '') {
                  nomeColetor = `Coletor ${String(coletor.user_id).substring(0, 8)}`;
                }

                console.log('👤 Processando coletor:', {
                  userId: coletor.user_id,
                  userIdType: typeof coletor.user_id,
                  usuarioId: usuario?.id,
                  usuarioIdType: typeof usuario?.id,
                  full_name: usuario?.full_name,
                  nomeColetor: nomeColetor,
                  match: usuario ? String(usuario.id) === String(coletor.user_id) : false
                });

                return {
                  coletor_nome: nomeColetor,
                  coletas: coletor.coletas,
                  massa: parseFloat(coletor.massa.toFixed(2))
                };
              }).sort((a, b) => b.coletas - a.coletas).slice(0, 10);

              console.log('📊 Dados finais dos coletores:', coletorData);
            }

          }

        } else {
          // COLETOR: Buscar dados específicos do usuário
          console.log('👤 Buscando dados como coletor, user_id:', userId);

          const { data: coletasUsuario, error: coletasError } = await coletasQuery.eq('user_id', userId);

          if (coletasError) {
            console.error('❌ Erro ao buscar coletas do usuário:', coletasError);
            throw coletasError;
          }

          console.log('📋 Coletas do usuário encontradas:', coletasUsuario?.length);

          if (coletasUsuario && coletasUsuario.length > 0) {
            // Resolver nomes dos municípios para os gráficos (Coletor)
            const uniqueCodes = [...new Set(coletasUsuario.map(c => c.municipio).filter(Boolean))];
            const resolvedNames = await fetchMunicipiosByCodes(uniqueCodes);

            const estadoMap = {};
            const municipioMap = {};

            coletasUsuario.forEach(coleta => {
              const municipio = coleta.municipio || 'Não informado';
              const estado = coleta.estado || municipioEstadoMap[municipio] || 'Estado não identificado';

              if (!estadoMap[estado]) {
                estadoMap[estado] = { coletas: 0, massa: 0 };
              }
              estadoMap[estado].coletas += 1;
              estadoMap[estado].massa += parseFloat(coleta.quantidade_coletada) || 0;

              if (!municipioMap[municipio]) {
                municipioMap[municipio] = { coletas: 0, massa: 0, estado: estado };
              }
              municipioMap[municipio].coletas += 1;
              municipioMap[municipio].massa += parseFloat(coleta.quantidade_coletada) || 0;
            });

            estadoData = Object.entries(estadoMap)
              .map(([estado, dados]) => ({
                local: estado,
                coletas: dados.coletas,
                massa: parseFloat(dados.massa.toFixed(2))
              }))
              .sort((a, b) => b.coletas - a.coletas);

            municipioData = Object.entries(municipioMap)
              .map(([municipio, dados]) => {
                const nomeMunicipio = !isNaN(municipio) && resolvedNames[municipio]
                  ? resolvedNames[municipio]
                  : municipio;
                return {
                  local: `${nomeMunicipio} - ${dados.estado}`,
                  coletas: dados.coletas,
                  massa: parseFloat(dados.massa.toFixed(2))
                };
              })
              .sort((a, b) => b.coletas - a.coletas)
              .slice(0, 10);
          }
        }

        // Dados por cliente
        let clienteQuery = supabase
          .from('coletas')
          .select('cliente_nome, quantidade_coletada, data_coleta, hora_coleta, cliente:clientes(nome_fantasia, razao_social, estado)');

        if (dateRange.start && dateRange.end) {
          const endOfDayISO = format(endOfDay(parseISO(dateRange.end)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
          clienteQuery = clienteQuery
            .gte('data_coleta', dateRange.start)
            .lte('data_coleta', endOfDayISO);
        }

        // Aplicar filtros de estado, município e coletor também na query de clientes
        if (filtroEstado && filtroEstado !== 'todos') {
          clienteQuery = clienteQuery.eq('estado', filtroEstado);
        }

        if (filtroMunicipio && filtroMunicipio !== 'todos') {
          clienteQuery = clienteQuery.eq('municipio', filtroMunicipio);
        }

        if (filtroColetor && filtroColetor !== 'all') {
          clienteQuery = clienteQuery.eq('user_id', filtroColetor);
        }

        if (!['administrador', 'super_admin'].includes(profile.role)) {
          clienteQuery = clienteQuery.eq('user_id', userId);
        }

        const { data: coletasCliente, error: clienteError } = await clienteQuery;

        if (!clienteError && coletasCliente) {
          console.log('👥 Dados por cliente:', coletasCliente.length);

          const clienteMap = {};
          coletasCliente.forEach(coleta => {
            // Priorizar nome_fantasia, depois razao_social, depois cliente_nome
            const nomeFantasia = coleta.cliente?.nome_fantasia;
            const razaoSocial = coleta.cliente?.razao_social;
            const clienteNome = coleta.cliente_nome;
            const estado = coleta.cliente?.estado || 'Estado não informado';

            // Usar nome_fantasia como chave principal, ou razao_social, ou cliente_nome
            const clienteNomeFinal = nomeFantasia || razaoSocial || clienteNome || 'Cliente não informado';

            // Chave composta: cliente/estado para agrupar por cliente e estado
            const clienteKey = `${clienteNomeFinal}|${estado}`;

            // Criar timestamp da coleta para ordenação cronológica
            const dataColeta = coleta.data_coleta || '';
            const horaColeta = coleta.hora_coleta || '00:00';
            const timestampColeta = dataColeta && horaColeta
              ? new Date(`${dataColeta}T${horaColeta}`).getTime()
              : new Date().getTime(); // Fallback para data atual se não houver data/hora

            if (!clienteMap[clienteKey]) {
              clienteMap[clienteKey] = {
                coletas: 0,
                massa: 0,
                nome_fantasia: nomeFantasia || null,
                razao_social: razaoSocial || null,
                cliente_nome: clienteNomeFinal,
                estado: estado,
                primeira_coleta_timestamp: timestampColeta // Guardar timestamp da primeira coleta
              };
            }
            clienteMap[clienteKey].coletas += 1;
            clienteMap[clienteKey].massa += parseFloat(coleta.quantidade_coletada) || 0;

            // Atualizar timestamp se esta coleta for anterior à primeira registrada
            if (timestampColeta < clienteMap[clienteKey].primeira_coleta_timestamp) {
              clienteMap[clienteKey].primeira_coleta_timestamp = timestampColeta;
            }
          });

          clienteData = Object.entries(clienteMap)
            .map(([cliente_key, dados]) => ({
              cliente_nome: `${dados.cliente_nome}/${dados.estado}`, // Formato: Cliente/Estado
              nome_fantasia: dados.nome_fantasia,
              razao_social: dados.razao_social,
              estado: dados.estado,
              coletas: dados.coletas,
              massa: parseFloat(dados.massa.toFixed(2)),
              primeira_coleta_timestamp: dados.primeira_coleta_timestamp
            }))
            .sort((a, b) => a.primeira_coleta_timestamp - b.primeira_coleta_timestamp) // Ordenar por ordem cronológica (primeira coleta do dia)
            .slice(0, 10);
        }

        // Calcular totais gerais
        const totalColetas = estadoData.reduce((acc, curr) => acc + (curr.coletas || 0), 0);
        const totalMassa = estadoData.reduce((acc, curr) => acc + (curr.massa || 0), 0);

        console.log('🎯 Dados finais processados:', {
          totalColetas,
          totalMassa,
          estadoDataCount: estadoData.length,
          municipioDataCount: municipioData.length,
          coletorDataCount: coletorData.length,
          clienteDataCount: clienteData.length
        });

        if (!isMounted) return;

        setStats({
          totalColetas,
          totalMassa,
          coletasPorEstado: estadoData,
          coletasPorMunicipio: municipioData,
          coletasPorColetor: coletorData,
          coletasPorCliente: clienteData,
        });

      } catch (error) {
        if (!isMounted) return;
        console.error('❌ Erro ao buscar dados do dashboard:', error);
        toast({
          title: 'Erro ao carregar dashboard',
          description: error.message || 'Não foi possível carregar os dados. Tente novamente.',
          variant: 'destructive'
        });
      } finally {
        if (isMounted) setDataLoading(false);
      }
    };

    if (!profileLoading && profile && user) {
      fetchDashboardData();
    } else if (!profileLoading) {
      setDataLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [toast, profile, profileLoading, user, periodoFiltro, dataInicio, dataFim, filtroEstado, filtroMunicipio, filtroColetor]);

  const handlePeriodoChange = (periodo) => {
    setPeriodoFiltro(periodo);

    if (periodo !== 'personalizado') {
      const dateRange = getDateRange(periodo);
      if (dateRange.start && dateRange.end) {
        setDataInicio(dateRange.start);
        setDataFim(dateRange.end);
        setDataInicioInput(dateRange.start);
        setDataFimInput(dateRange.end);
      }
    }
  };

  const handleCustomDateFilter = () => {
    if (dataInicioInput && dataFimInput) {
      // Validar se as datas são válidas
      const inicio = new Date(dataInicioInput);
      const fim = new Date(dataFimInput);

      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        toast({
          title: 'Datas inválidas',
          description: 'Por favor, selecione datas válidas.',
          variant: 'destructive'
        });
        return;
      }

      if (inicio > fim) {
        toast({
          title: 'Datas inválidas',
          description: 'A data de início deve ser anterior à data de fim.',
          variant: 'destructive'
        });
        return;
      }

      // Atualizar os estados principais que disparam a busca
      setDataInicio(dataInicioInput);
      setDataFim(dataFimInput);
      setPeriodoFiltro('personalizado');
    } else {
      toast({
        title: 'Datas inválidas',
        description: 'Selecione ambas as datas para filtrar.',
        variant: 'destructive'
      });
    }
  };

  const clearFilters = () => {
    setPeriodoFiltro('personalizado');
    const defaultDates = getDefaultMonthDates();
    setDataInicio(defaultDates.start);
    setDataFim(defaultDates.end);
    setDataInicioInput(defaultDates.start);
    setDataFimInput(defaultDates.end);
    setFiltroEstado('todos');
    setFiltroMunicipio('todos');
    setFiltroColetor('all');
  };

  // Preparar opções para os selects
  const estadoOptions = [
    { value: 'todos', label: `Estado: Todos (${estadosFiltro.length})` },
    ...estadosFiltro.map(e => ({ value: e, label: e }))
  ];

  const municipioOptions = [
    { value: 'todos', label: `Município: Todos (${municipiosFiltro.length})` },
    ...municipiosFiltro
  ];

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-white">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-white">Carregando dados do dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Usuário não autenticado</h3>
          <p className="text-gray-400">Faça login para acessar o dashboard.</p>
        </div>
      </div>
    );
  }

  const chartTitle = profile?.role === 'administrador'
    ? 'Coletas por Estado'
    : 'Minhas Coletas por Estado';

  const chartDataKey = 'local';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800/80 border border-gray-600 rounded-xl text-white">
          <p className="label font-bold">{`${label}`}</p>
          <p className="text-emerald-400">{`Nº de Coletas: ${payload[0].value}`}</p>
          <p className="text-yellow-400">{`Massa (kg): ${formatNumber(payload[1].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  // Mapeamento de siglas de estados para nomes completos
  const estadosNomesMap = {
    'AC': 'Acre',
    'AL': 'Alagoas',
    'AP': 'Amapá',
    'AM': 'Amazonas',
    'BA': 'Bahia',
    'CE': 'Ceará',
    'DF': 'Distrito Federal',
    'ES': 'Espírito Santo',
    'GO': 'Goiás',
    'MA': 'Maranhão',
    'MT': 'Mato Grosso',
    'MS': 'Mato Grosso do Sul',
    'MG': 'Minas Gerais',
    'PA': 'Pará',
    'PB': 'Paraíba',
    'PR': 'Paraná',
    'PE': 'Pernambuco',
    'PI': 'Piauí',
    'RJ': 'Rio de Janeiro',
    'RN': 'Rio Grande do Norte',
    'RS': 'Rio Grande do Sul',
    'RO': 'Rondônia',
    'RR': 'Roraima',
    'SC': 'Santa Catarina',
    'SP': 'São Paulo',
    'SE': 'Sergipe',
    'TO': 'Tocantins'
  };

  const CustomTooltipCliente = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const nomeFantasia = data?.nome_fantasia || label;
      const razaoSocial = data?.razao_social;
      const estadoSigla = data?.estado || '';
      const estadoNome = estadosNomesMap[estadoSigla] || estadoSigla || 'Estado não informado';

      return (
        <div className="p-3 bg-gray-800/90 border border-gray-600 rounded-xl text-white shadow-lg">
          <p className="label font-bold text-emerald-300 mb-1">{nomeFantasia}</p>
          {razaoSocial && (
            <p className="text-sm text-gray-300 mb-1">{razaoSocial}</p>
          )}
          <p className="text-sm text-gray-400 mb-2">Estado: {estadoNome}</p>
          <p className="text-emerald-400">{`Nº de Coletas: ${payload[0].value}`}</p>
          <p className="text-yellow-400">{`Massa (kg): ${formatNumber(payload[1].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - RJR Óleo</title>
      </Helmet>
      <div className="animate-fade-in space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-8 h-8 text-emerald-400" /> Dashboard
          </h1>
          <p className="text-emerald-200/80 mt-1">
            {profile?.role === 'administrador'
              ? 'Visão geral e indicadores de performance do sistema.'
              : `Visão das suas coletas - ${user?.email || 'Coletor'}`
            }
          </p>
        </div>

        {/* SEÇÃO DE FILTROS - CORRIGIDO DESKTOP */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-emerald-300 text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Filtros de Período
              </CardTitle>

              {/* Botão de filtros mobile - APENAS NO MOBILE */}
              {isMobile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 border-white/30 text-white hover:bg-white/10"
                >
                  <Filter className="w-4 h-4" />
                  {showFilters ? 'Ocultar' : 'Mostrar'}
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className={`${isMobile && !showFilters ? 'hidden' : 'block'}`}>
              {/* DESKTOP: Layout Flexível para aproximar os campos */}
              <div className="flex flex-col md:grid md:grid-cols-4 lg:flex lg:flex-row lg:flex-wrap gap-4 md:gap-2 items-end">

                {/* Estado - ~15% no desktop */}
                <div className="md:col-span-1 lg:w-[15%] min-w-[120px] space-y-2">
                  <div className="relative">
                    <select
                      id="filtroEstado"
                      className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                      {estadoOptions.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                  </div>
                </div>

                {/* Município - ~25% no desktop */}
                <div className="md:col-span-1 lg:w-[25%] min-w-[180px] space-y-2">
                  <div className="relative">
                    <select
                      id="filtroMunicipio"
                      className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50"
                      value={filtroMunicipio}
                      onChange={(e) => setFiltroMunicipio(e.target.value)}
                    >
                      {municipioOptions.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                  </div>
                </div>

                {/* Coletor - Apenas para admin */}
                {profile?.role === 'administrador' && (
                  <div className="md:col-span-2 lg:w-[20%] min-w-[150px] space-y-2">
                    <UserSearchableSelect
                      labelText="Coletor"
                      value={filtroColetor}
                      onChange={setFiltroColetor}
                      users={coletores}
                      inputClassName="bg-white/10 border-white/20 text-white rounded-xl h-11 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* Período - Compacto */}
                <div className="md:col-span-1 lg:w-[12%] min-w-[130px] space-y-2">
                  <div className="relative">
                    <select
                      id="periodo"
                      className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                      value={periodoFiltro}
                      onChange={(e) => handlePeriodoChange(e.target.value)}
                    >
                      <option value="personalizado" className="bg-slate-900">Período Personalizado</option>
                      <option value="semana" className="bg-slate-900">Última Semana</option>
                      <option value="quinzena" className="bg-slate-900">Última Quinzena</option>
                      <option value="mes" className="bg-slate-900">Último Mês</option>
                      <option value="bimestre" className="bg-slate-900">Último Bimestre</option>
                      <option value="trimestre" className="bg-slate-900">Último Trimestre</option>
                      <option value="semestre" className="bg-slate-900">Último Semestre</option>
                      <option value="ano" className="bg-slate-900">Último Ano</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                  </div>
                </div>

                {/* Data Início */}
                <div className="md:col-span-1 lg:w-[10%] min-w-[110px] space-y-2">
                  <input
                    type="date"
                    id="dataInicio"
                    value={dataInicioInput}
                    onChange={(e) => setDataInicioInput(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 h-11 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:border-transparent transition-all"
                  />
                </div>

                {/* Data Fim */}
                <div className="md:col-span-1 lg:w-[10%] min-w-[110px] space-y-2">
                  <input
                    type="date"
                    id="dataFim"
                    value={dataFimInput}
                    onChange={(e) => setDataFimInput(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 h-11 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:border-transparent transition-all"
                  />
                </div>

                {/* Botões de Ação */}
                <div className="md:col-span-1 flex gap-2 items-end">
                  <Button
                    onClick={handleCustomDateFilter}
                    disabled={!dataInicioInput || !dataFimInput}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-6 flex items-center justify-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-xl h-11 px-6 flex items-center justify-center gap-2"
                  >
                    <Eraser className="h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>

              {/* MOBILE: Layout vertical */}
              <div className="md:hidden space-y-4 mt-4">
                <div className="space-y-2">
                  <div className="relative">
                    <select
                      id="filtroEstado-mobile"
                      className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                      value={filtroEstado}
                      onChange={(e) => setFiltroEstado(e.target.value)}
                    >
                      {estadoOptions.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <select
                      id="filtroMunicipio-mobile"
                      className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50"
                      value={filtroMunicipio}
                      onChange={(e) => setFiltroMunicipio(e.target.value)}
                    >
                      {municipioOptions.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                  </div>
                </div>

                {profile?.role === 'administrador' && (
                  <div className="space-y-2">
                    <UserSearchableSelect
                      labelText="Coletor"
                      value={filtroColetor}
                      onChange={setFiltroColetor}
                      users={coletores}
                      inputClassName="bg-white/10 border-white/20 text-white rounded-xl h-11 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="relative">
                    <select
                      id="periodo-mobile"
                      className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                      value={periodoFiltro}
                      onChange={(e) => handlePeriodoChange(e.target.value)}
                    >
                      <option value="personalizado" className="bg-slate-900">Período Personalizado</option>
                      <option value="semana" className="bg-slate-900">Última Semana</option>
                      <option value="quinzena" className="bg-slate-900">Última Quinzena</option>
                      <option value="mes" className="bg-slate-900">Último Mês</option>
                      <option value="bimestre" className="bg-slate-900">Último Bimestre</option>
                      <option value="trimestre" className="bg-slate-900">Último Trimestre</option>
                      <option value="semestre" className="bg-slate-900">Último Semestre</option>
                      <option value="ano" className="bg-slate-900">Último Ano</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <input
                      type="date"
                      id="dataInicio-mobile"
                      value={dataInicioInput}
                      onChange={(e) => setDataInicioInput(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 h-11 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <input
                      type="date"
                      id="dataFim-mobile"
                      value={dataFimInput}
                      onChange={(e) => setDataFimInput(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2 h-11 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    onClick={handleCustomDateFilter}
                    disabled={!dataInicioInput || !dataFimInput}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-4 flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10 rounded-xl h-11 px-4 flex items-center gap-2"
                  >
                    <Eraser className="h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-300">
                {profile?.role === 'administrador' ? 'Total de Coletas' : 'Minhas Coletas'}
              </CardTitle>
              <Truck className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalColetas}</div>
              <p className="text-xs text-gray-400">
                {profile?.role === 'administrador' ? 'Registros de coletas no sistema' : 'Coletas realizadas por você'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-300">
                {profile?.role === 'administrador' ? 'Massa Total Coletada (kg)' : 'Minha Massa Coletada (kg)'}
              </CardTitle>
              <Droplets className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalMassa)}</div>
              <p className="text-xs text-gray-400">
                {profile?.role === 'administrador' ? 'Quilogramas de óleo coletado' : 'Kg de óleo coletados por você'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Resto dos componentes permanece igual */}
        {/* Gráfico Principal - Coletas por Estado */}
        {stats.coletasPorEstado.length > 0 ? (
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300">{chartTitle}</CardTitle>
              <CardDescription className="text-gray-400">
                {profile?.role === 'administrador'
                  ? 'Visualização da performance em cada estado.'
                  : 'Performance das suas coletas por estado.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.coletasPorEstado}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis dataKey={chartDataKey} stroke="#9ca3af" />
                  <YAxis yAxisId="left" orientation="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#fff' }} />
                  <Bar yAxisId="left" dataKey="coletas" fill="#34d399" name="Nº de Coletas" />
                  <Bar yAxisId="right" dataKey="massa" fill="#fbbf24" name="Massa (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : stats.totalColetas > 0 ? (
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardContent className="p-8 text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                Dados de localização não encontrados
              </h3>
              <p className="text-gray-400">
                {profile?.role === 'administrador'
                  ? 'As coletas não possuem informações de município para determinar o estado.'
                  : 'Suas coletas não possuem informações de município para determinar o estado.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardContent className="p-8 text-center">
              <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                {profile?.role === 'administrador' ? 'Nenhuma coleta encontrada' : 'Nenhuma coleta realizada'}
              </h3>
              <p className="text-gray-400">
                {profile?.role === 'administrador'
                  ? 'Não há coletas registradas no sistema ainda.'
                  : 'Você ainda não realizou nenhuma coleta.'
                }
              </p>
            </CardContent>
          </Card>
        )}

        {/* Coletas por Município */}
        {stats.coletasPorMunicipio.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {profile?.role === 'administrador' ? 'Coletas por Município' : 'Minhas Coletas por Município'}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Performance por município (Top 10)
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.coletasPorMunicipio} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis type="category" dataKey="local" width={120} stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#fff' }} />
                  <Bar dataKey="coletas" fill="#34d399" name="Nº de Coletas" />
                  <Bar dataKey="massa" fill="#fbbf24" name="Massa (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Coletas por Coletor - Apenas para admin */}
        {profile?.role === 'administrador' && stats.coletasPorColetor.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2">
                <User className="h-5 w-5" /> Coletas por Coletor
              </CardTitle>
              <CardDescription className="text-gray-400">Performance por coletor (Top 10)</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.coletasPorColetor} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis type="category" dataKey="coletor_nome" width={120} stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: '#fff' }} />
                  <Bar dataKey="coletas" fill="#34d399" name="Nº de Coletas" />
                  <Bar dataKey="massa" fill="#fbbf24" name="Massa (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Coletas por Cliente */}
        {stats.coletasPorCliente.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader>
              <CardTitle className="text-emerald-300 flex items-center gap-2">
                <Users className="h-5 w-5" />
                {profile?.role === 'administrador' ? 'Coletas por Cliente' : 'Meus Clientes'}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {profile?.role === 'administrador'
                  ? 'Clientes com maior volume de coleta (Top 10)'
                  : 'Seus clientes com maior volume de coleta (Top 10)'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={600}>
                <BarChart data={stats.coletasPorCliente} layout="vertical" barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis
                    type="category"
                    dataKey="cliente_nome"
                    width={220}
                    stroke="#9ca3af"
                    tick={{ fontSize: 13, fill: '#e5e7eb' }}
                    interval={0}
                  />
                  <Tooltip content={<CustomTooltipCliente />} />
                  <Legend wrapperStyle={{ color: '#fff' }} />
                  <Bar dataKey="coletas" fill="#34d399" name="Nº de Coletas" />
                  <Bar dataKey="massa" fill="#fbbf24" name="Massa (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

      </div >
    </>
  );
};

export default DashboardPage;