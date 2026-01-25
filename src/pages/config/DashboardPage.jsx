import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Truck, Droplets, MapPin, User, LayoutDashboard, Users, Calendar, Eraser, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useLocationData } from '@/hooks/useLocationData';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { UserSearchableSelect } from '@/components/ui/UserSearchableSelect';

const DashboardPage = () => {
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
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataInicioInput, setDataInicioInput] = useState(''); // Estado local para o input
  const [dataFimInput, setDataFimInput] = useState(''); // Estado local para o input
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [filtroMunicipio, setFiltroMunicipio] = useState('all');
  const [filtroColetor, setFiltroColetor] = useState('all');
  const [municipios, setMunicipios] = useState([]);
  const [coletores, setColetores] = useState([]);
  
  // Buscar estados e municípios
  const { estados, fetchMunicipios } = useLocationData();

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Função para formatar data como YYYY-MM-DD
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Função para obter datas padrão do mês atual
  const getDefaultMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      start: formatDate(firstDay),
      end: formatDate(lastDay)
    };
  };

  // Inicializar datas com valores padrão do mês atual
  useEffect(() => {
    const defaultDates = getDefaultMonthDates();
    setDataInicio(defaultDates.start);
    setDataFim(defaultDates.end);
    setDataInicioInput(defaultDates.start);
    setDataFimInput(defaultDates.end);
  }, []);

  // Buscar municípios quando estado for selecionado
  useEffect(() => {
    const loadMunicipios = async () => {
      if (filtroEstado && filtroEstado !== 'all') {
        const municipiosList = await fetchMunicipios(filtroEstado);
        setMunicipios(municipiosList);
        // Resetar município quando estado mudar
        setFiltroMunicipio('all');
      } else {
        setMunicipios([]);
        setFiltroMunicipio('all');
      }
    };
    loadMunicipios();
  }, [filtroEstado, fetchMunicipios]);

  // Buscar lista de coletores
  useEffect(() => {
    const fetchColetores = async () => {
      if (profile?.role !== 'administrador') {
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
          const coletoresFiltrados = usuariosRPC.filter(u => u.role === 'coletor');
          console.log('✅ Coletores encontrados via RPC:', coletoresFiltrados.length);
          
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
          .eq('role', 'coletor')
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

  // Função para obter datas baseadas no período selecionado
  const getDateRange = (periodo) => {
    const now = new Date();
    const start = new Date();
    
    switch (periodo) {
      case 'semana':
        start.setDate(now.getDate() - 7);
        break;
      case 'quinzena':
        start.setDate(now.getDate() - 15);
        break;
      case 'mes':
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return { 
          start: formatDate(firstDay), 
          end: formatDate(lastDay) 
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
      start: formatDate(start), 
      end: formatDate(now) 
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
          coletasQuery = coletasQuery
            .gte('data_coleta', dateRange.start)
            .lte('data_coleta', dateRange.end);
        }

        // Aplicar filtros de estado, município e coletor
        if (filtroEstado && filtroEstado !== 'all') {
          coletasQuery = coletasQuery.eq('estado', filtroEstado);
        }
        
        if (filtroMunicipio && filtroMunicipio !== 'all') {
          coletasQuery = coletasQuery.eq('municipio', filtroMunicipio);
        }
        
        if (filtroColetor && filtroColetor !== 'all') {
          coletasQuery = coletasQuery.eq('user_id', filtroColetor);
        }

        if (profile.role === 'administrador') {
          console.log('👑 Buscando dados como administrador...');
          
          const { data: todasColetas, error: coletasError } = await coletasQuery;

          if (coletasError) {
            console.error('❌ Erro ao buscar coletas:', coletasError);
            throw coletasError;
          }

          console.log('📋 Total de coletas encontradas:', todasColetas?.length);

          if (todasColetas && todasColetas.length > 0) {
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
              .map(([municipio, dados]) => ({
                local: `${municipio} - ${dados.estado}`,
                coletas: dados.coletas,
                massa: parseFloat(dados.massa.toFixed(2))
              }))
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
              .map(([municipio, dados]) => ({
                local: `${municipio} - ${dados.estado}`,
                coletas: dados.coletas,
                massa: parseFloat(dados.massa.toFixed(2))
              }))
              .sort((a, b) => b.coletas - a.coletas)
              .slice(0, 10);
          }
        }

        // Dados por cliente
        let clienteQuery = supabase
          .from('coletas')
          .select('cliente_nome, quantidade_coletada, data_coleta, hora_coleta, cliente:clientes(nome_fantasia, razao_social, estado)');

        if (dateRange.start && dateRange.end) {
          clienteQuery = clienteQuery
            .gte('data_coleta', dateRange.start)
            .lte('data_coleta', dateRange.end);
        }

        // Aplicar filtros de estado, município e coletor também na query de clientes
        if (filtroEstado && filtroEstado !== 'all') {
          clienteQuery = clienteQuery.eq('estado', filtroEstado);
        }
        
        if (filtroMunicipio && filtroMunicipio !== 'all') {
          clienteQuery = clienteQuery.eq('municipio', filtroMunicipio);
        }
        
        if (filtroColetor && filtroColetor !== 'all') {
          clienteQuery = clienteQuery.eq('user_id', filtroColetor);
        }

        if (profile.role !== 'administrador') {
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

        setStats({
          totalColetas,
          totalMassa,
          coletasPorEstado: estadoData,
          coletasPorMunicipio: municipioData,
          coletasPorColetor: coletorData,
          coletasPorCliente: clienteData,
        });

      } catch (error) {
        console.error('❌ Erro ao buscar dados do dashboard:', error);
        toast({ 
          title: 'Erro ao carregar dashboard', 
          description: error.message || 'Não foi possível carregar os dados. Tente novamente.',
          variant: 'destructive' 
        });
      } finally {
        setDataLoading(false);
      }
    };
    
    if (!profileLoading && profile && user) {
      fetchDashboardData();
    } else if (!profileLoading) {
      setDataLoading(false);
    }
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
    setFiltroEstado('all');
    setFiltroMunicipio('all');
    setFiltroColetor('all');
  };

  // Preparar opções para os selects
  const estadoOptions = [
    { value: 'all', label: 'Todos os Estados' },
    ...estados.map(e => ({ value: e.value, label: e.label }))
  ];

  const municipioOptions = [
    { value: 'all', label: 'Todos os Municípios' },
    ...municipios.map(m => ({ value: m, label: m }))
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
              {/* DESKTOP: Grid alinhado corretamente */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                
                {/* Estado - 2 colunas */}
                <div className="md:col-span-2 space-y-2">
                  <SearchableSelect
                    options={estadoOptions}
                    value={filtroEstado}
                    onChange={setFiltroEstado}
                    labelText="Estado"
                    inputClassName="bg-white/20 border-white/30 text-white rounded-xl h-10"
                  />
                </div>

                {/* Município - 2 colunas */}
                <div className="md:col-span-2 space-y-2">
                  <SearchableSelect
                    options={municipioOptions}
                    value={filtroMunicipio}
                    onChange={setFiltroMunicipio}
                    labelText="Município"
                    inputClassName="bg-white/20 border-white/30 text-white rounded-xl h-10"
                    disabled={!filtroEstado || filtroEstado === 'all'}
                  />
                </div>

                {/* Coletor - 2 colunas (apenas para admin) */}
                {profile?.role === 'administrador' ? (
                  <div className="md:col-span-2 space-y-2">
                    <UserSearchableSelect
                      labelText="Coletor"
                      value={filtroColetor}
                      onChange={setFiltroColetor}
                      users={coletores}
                      inputClassName="bg-white/20 border-white/30 text-white rounded-xl h-10"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-2"></div>
                )}

                {/* Período - 1.5 colunas (aumentado um pouco) */}
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="periodo" className="text-white mb-2 block text-sm">Período</Label>
                  <Select value={periodoFiltro} onValueChange={handlePeriodoChange}>
                    <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl h-10">
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 text-white rounded-xl">
                      <SelectItem value="personalizado">Período Personalizado</SelectItem>
                      <SelectItem value="semana">Última Semana</SelectItem>
                      <SelectItem value="quinzena">Última Quinzena</SelectItem>
                      <SelectItem value="mes">Último Mês</SelectItem>
                      <SelectItem value="bimestre">Último Bimestre</SelectItem>
                      <SelectItem value="trimestre">Último Trimestre</SelectItem>
                      <SelectItem value="semestre">Último Semestre</SelectItem>
                      <SelectItem value="ano">Último Ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Data Início - 1 coluna */}
                <div className="md:col-span-1 space-y-2">
                  <Label htmlFor="dataInicio" className="text-white mb-2 block text-sm">Data Início</Label>
                  <input
                    type="date"
                    id="dataInicio"
                    value={dataInicioInput}
                    onChange={(e) => setDataInicioInput(e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>

                {/* Data Fim - 1 coluna */}
                <div className="md:col-span-1 space-y-2">
                  <Label htmlFor="dataFim" className="text-white mb-2 block text-sm">Data Fim</Label>
                  <input
                    type="date"
                    id="dataFim"
                    value={dataFimInput}
                    onChange={(e) => setDataFimInput(e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>

                {/* Botões de Ação - 2 colunas */}
                <div className="md:col-span-2 flex gap-2.5 items-end justify-end" style={{ marginLeft: 'auto', paddingLeft: '2rem' }}>
                  <Button 
                    onClick={handleCustomDateFilter}
                    disabled={!dataInicioInput || !dataFimInput}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-3 flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 rounded-xl h-10 px-2 flex items-center gap-1.5"
                  >
                    <Eraser className="h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>

              {/* MOBILE: Layout vertical */}
              <div className="md:hidden space-y-4 mt-4">
                <div className="space-y-2">
                  <SearchableSelect
                    options={estadoOptions}
                    value={filtroEstado}
                    onChange={setFiltroEstado}
                    labelText="Estado"
                    inputClassName="bg-white/20 border-white/30 text-white rounded-xl h-10"
                  />
                </div>

                <div className="space-y-2">
                  <SearchableSelect
                    options={municipioOptions}
                    value={filtroMunicipio}
                    onChange={setFiltroMunicipio}
                    labelText="Município"
                    inputClassName="bg-white/20 border-white/30 text-white rounded-xl h-10"
                    disabled={!filtroEstado || filtroEstado === 'all'}
                  />
                </div>

                {profile?.role === 'administrador' && (
                  <div className="space-y-2">
                    <UserSearchableSelect
                      labelText="Coletor"
                      value={filtroColetor}
                      onChange={setFiltroColetor}
                      users={coletores}
                      inputClassName="bg-white/20 border-white/30 text-white rounded-xl h-10"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="periodo-mobile" className="text-white mb-2 block text-sm">Período</Label>
                  <Select value={periodoFiltro} onValueChange={handlePeriodoChange}>
                    <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl h-10">
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 text-white rounded-xl">
                      <SelectItem value="personalizado">Período Personalizado</SelectItem>
                      <SelectItem value="semana">Última Semana</SelectItem>
                      <SelectItem value="quinzena">Última Quinzena</SelectItem>
                      <SelectItem value="mes">Último Mês</SelectItem>
                      <SelectItem value="bimestre">Último Bimestre</SelectItem>
                      <SelectItem value="trimestre">Último Trimestre</SelectItem>
                      <SelectItem value="semestre">Último Semestre</SelectItem>
                      <SelectItem value="ano">Último Ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dataInicio-mobile" className="text-white mb-2 block text-sm">Data Início</Label>
                    <input
                      type="date"
                      id="dataInicio-mobile"
                      value={dataInicioInput}
                      onChange={(e) => setDataInicioInput(e.target.value)}
                      className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dataFim-mobile" className="text-white mb-2 block text-sm">Data Fim</Label>
                    <input
                      type="date"
                      id="dataFim-mobile"
                      value={dataFimInput}
                      onChange={(e) => setDataFimInput(e.target.value)}
                      className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button 
                    onClick={handleCustomDateFilter}
                    disabled={!dataInicioInput || !dataFimInput}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-3 flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 rounded-xl h-10 px-2 flex items-center gap-1.5"
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

      </div>
    </>
  );
};

export default DashboardPage;