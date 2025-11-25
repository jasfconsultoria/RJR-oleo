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
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
  }, []);

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
  const fetchUsuariosInfo = async (userIds) => {
    try {
      console.log('🔍 Buscando informações dos usuários com IDs:', userIds);
      
      if (!userIds || userIds.length === 0) {
        console.log('⚠️ Nenhum user_id fornecido para busca');
        return [];
      }

      // Buscar da tabela profiles com as colunas corretas
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, estado, municipio')
        .in('id', userIds);

      if (error) {
        console.error('❌ Erro ao buscar perfis:', error);
        // Fallback básico
        return userIds.map(id => ({
          id: id,
          full_name: `Coletor ${id.substring(0, 8)}`
        }));
      }

      console.log('✅ Perfis encontrados:', data?.length);
      
      // Combinar com fallback para usuários não encontrados
      const result = userIds.map(userId => {
        const usuario = data?.find(u => u.id === userId);
        return {
          id: userId,
          full_name: usuario?.full_name || `Coletor ${userId.substring(0, 8)}`,
          role: usuario?.role,
          estado: usuario?.estado,
          municipio: usuario?.municipio
        };
      });

      return result;
    } catch (error) {
      console.error('❌ Erro ao buscar informações dos usuários:', error);
      // Fallback final
      return userIds.map(id => ({
        id: id,
        full_name: `Coletor ${id.substring(0, 8)}`
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

              // Combinar dados - USANDO FULL_NAME
              coletorData = Object.values(coletorMap).map(coletor => {
                const usuario = usuarios?.find(u => u.id === coletor.user_id);
                
                // Usar full_name da tabela profiles
                const nomeColetor = usuario?.full_name || `Coletor ${coletor.user_id.substring(0, 8)}`;
                
                console.log('👤 Processando coletor:', {
                  userId: coletor.user_id,
                  full_name: usuario?.full_name,
                  nomeColetor: nomeColetor
                });
                
                return {
                  coletor_nome: nomeColetor,
                  coletas: coletor.coletas,
                  massa: parseFloat(coletor.massa.toFixed(2))
                };
              }).sort((a, b) => b.coletas - a.coletas).slice(0, 10);
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
          .select('cliente_nome, quantidade_coletada');

        if (dateRange.start && dateRange.end) {
          clienteQuery = clienteQuery
            .gte('data_coleta', dateRange.start)
            .lte('data_coleta', dateRange.end);
        }

        if (profile.role !== 'administrador') {
          clienteQuery = clienteQuery.eq('user_id', userId);
        }

        const { data: coletasCliente, error: clienteError } = await clienteQuery;

        if (!clienteError && coletasCliente) {
          console.log('👥 Dados por cliente:', coletasCliente.length);
          
          const clienteMap = {};
          coletasCliente.forEach(coleta => {
            const cliente = coleta.cliente_nome || 'Cliente não informado';
            if (!clienteMap[cliente]) {
              clienteMap[cliente] = { coletas: 0, massa: 0 };
            }
            clienteMap[cliente].coletas += 1;
            clienteMap[cliente].massa += parseFloat(coleta.quantidade_coletada) || 0;
          });
          
          clienteData = Object.entries(clienteMap)
            .map(([cliente_nome, dados]) => ({
              cliente_nome,
              coletas: dados.coletas,
              massa: parseFloat(dados.massa.toFixed(2))
            }))
            .sort((a, b) => b.coletas - a.coletas)
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
  }, [toast, profile, profileLoading, user, periodoFiltro, dataInicio, dataFim]);

  const handlePeriodoChange = (periodo) => {
    setPeriodoFiltro(periodo);
    
    if (periodo !== 'personalizado') {
      const dateRange = getDateRange(periodo);
      if (dateRange.start && dateRange.end) {
        setDataInicio(dateRange.start);
        setDataFim(dateRange.end);
      }
    }
  };

  const handleCustomDateFilter = () => {
    if (dataInicio && dataFim) {
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
  };

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
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                
                {/* Período - 3 colunas */}
                <div className="md:col-span-3 space-y-2">
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

                {/* Data Início - 3 colunas */}
                <div className="md:col-span-3 space-y-2">
                  <Label htmlFor="dataInicio" className="text-white mb-2 block text-sm">Data Início</Label>
                  <input
                    type="date"
                    id="dataInicio"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>

                {/* Data Fim - 3 colunas */}
                <div className="md:col-span-3 space-y-2">
                  <Label htmlFor="dataFim" className="text-white mb-2 block text-sm">Data Fim</Label>
                  <input
                    type="date"
                    id="dataFim"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                  />
                </div>

                {/* Botões de Ação - 3 colunas */}
                <div className="md:col-span-3 flex gap-2 items-end">
                  <Button 
                    onClick={handleCustomDateFilter}
                    disabled={!dataInicio || !dataFim}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 flex-1 flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 rounded-xl h-10 px-4 flex items-center gap-2"
                  >
                    <Eraser className="h-4 w-4" />
                    Limpar
                  </Button>
                </div>
              </div>

              {/* MOBILE: Layout vertical */}
              <div className="md:hidden space-y-4 mt-4">
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
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dataFim-mobile" className="text-white mb-2 block text-sm">Data Fim</Label>
                    <input
                      type="date"
                      id="dataFim-mobile"
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                      className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleCustomDateFilter}
                    disabled={!dataInicio || !dataFim}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 flex-1 flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Filtrar
                  </Button>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 rounded-xl h-10 px-4 flex items-center gap-2"
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
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.coletasPorCliente} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis type="category" dataKey="cliente_nome" width={120} stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
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