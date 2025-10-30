import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Truck, Droplets, MapPin, User, LayoutDashboard, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatNumber } from '@/lib/utils';

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

  // Função para obter o user_id correto
  const getUserId = () => {
    if (user?.id) return user.id;
    if (profile?.id) return profile.id;
    return null;
  };

  // Função para obter estado a partir do município (simulação)
  const getEstadoFromMunicipio = (municipio) => {
    if (!municipio || municipio === 'Não informado') return 'Não informado';
    
    // Mapeamento básico de municípios para estados (você pode expandir isso)
    const municipioToEstado = {
      // Exemplos - adicione mais conforme sua base de dados
      'São Paulo': 'SP',
      'Rio de Janeiro': 'RJ',
      'Belo Horizonte': 'MG',
      'Salvador': 'BA',
      'Fortaleza': 'CE',
      'Brasília': 'DF',
      // Adicione mais mapeamentos conforme necessário
    };
    
    return municipioToEstado[municipio] || 'Estado não identificado';
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
          email: user?.email 
        });

        let estadoData = [];
        let municipioData = [];
        let coletorData = [];
        let clienteData = [];

        if (profile.role === 'administrador') {
          console.log('👑 Buscando dados como administrador...');
          
          // ADMIN: Buscar dados completos do sistema
          
          // 1. Buscar todas as coletas com município
          const { data: todasColetas, error: coletasError } = await supabase
            .from('coletas')
            .select('*');

          if (coletasError) {
            console.error('❌ Erro ao buscar coletas:', coletasError);
            throw coletasError;
          }

          console.log('📋 Total de coletas encontradas:', todasColetas?.length);

          if (todasColetas && todasColetas.length > 0) {
            // Processar dados por estado (a partir do município)
            const estadoMap = {};
            const municipioMap = {};

            todasColetas.forEach(coleta => {
              const municipio = coleta.municipio || 'Não informado';
              const estado = getEstadoFromMunicipio(municipio);
              
              // Agrupar por estado
              if (!estadoMap[estado]) {
                estadoMap[estado] = { coletas: 0, massa: 0 };
              }
              estadoMap[estado].coletas += 1;
              estadoMap[estado].massa += parseFloat(coleta.quantidade_coletada) || 0;
              
              // Agrupar por município
              if (!municipioMap[municipio]) {
                municipioMap[municipio] = { coletas: 0, massa: 0 };
              }
              municipioMap[municipio].coletas += 1;
              municipioMap[municipio].massa += parseFloat(coleta.quantidade_coletada) || 0;
            });
            
            estadoData = Object.entries(estadoMap).map(([estado, dados]) => ({
              local: estado,
              coletas: dados.coletas,
              massa: parseFloat(dados.massa.toFixed(2))
            }));
            
            municipioData = Object.entries(municipioMap)
              .map(([municipio, dados]) => ({
                local: municipio,
                coletas: dados.coletas,
                massa: parseFloat(dados.massa.toFixed(2))
              }))
              .sort((a, b) => b.coletas - a.coletas)
              .slice(0, 10);

            console.log('📈 Dados por estado processados:', estadoData);
            console.log('🏙️ Dados por município processados:', municipioData);

            // 2. Dados por coletor
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

            // Buscar informações dos usuários
            const userIds = Object.keys(coletorMap);
            const { data: usuarios, error: usuariosError } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds);

            if (usuariosError) {
              console.error('❌ Erro ao buscar usuários:', usuariosError);
            }

            console.log('👤 Usuários encontrados:', usuarios?.length);

            // Combinar dados
            coletorData = Object.values(coletorMap).map(coletor => {
              const usuario = usuarios?.find(u => u.id === coletor.user_id);
              return {
                coletor_nome: usuario?.full_name || usuario?.email || `Coletor ${coletor.user_id.substring(0, 8)}`,
                coletas: coletor.coletas,
                massa: parseFloat(coletor.massa.toFixed(2))
              };
            }).sort((a, b) => b.coletas - a.coletas).slice(0, 10);

          }

        } else {
          // COLETOR: Buscar dados específicos do usuário
          console.log('👤 Buscando dados como coletor, user_id:', userId);
          
          // Buscar coletas do usuário
          const { data: coletasUsuario, error: coletasError } = await supabase
            .from('coletas')
            .select('*')
            .eq('user_id', userId);

          if (coletasError) {
            console.error('❌ Erro ao buscar coletas do usuário:', coletasError);
            throw coletasError;
          }

          console.log('📋 Coletas do usuário encontradas:', coletasUsuario?.length);

          if (coletasUsuario && coletasUsuario.length > 0) {
            // Processar dados por estado (a partir do município)
            const estadoMap = {};
            const municipioMap = {};

            coletasUsuario.forEach(coleta => {
              const municipio = coleta.municipio || 'Não informado';
              const estado = getEstadoFromMunicipio(municipio);
              
              // Agrupar por estado
              if (!estadoMap[estado]) {
                estadoMap[estado] = { coletas: 0, massa: 0 };
              }
              estadoMap[estado].coletas += 1;
              estadoMap[estado].massa += parseFloat(coleta.quantidade_coletada) || 0;
              
              // Agrupar por município
              if (!municipioMap[municipio]) {
                municipioMap[municipio] = { coletas: 0, massa: 0 };
              }
              municipioMap[municipio].coletas += 1;
              municipioMap[municipio].massa += parseFloat(coleta.quantidade_coletada) || 0;
            });
            
            estadoData = Object.entries(estadoMap).map(([estado, dados]) => ({
              local: estado,
              coletas: dados.coletas,
              massa: parseFloat(dados.massa.toFixed(2))
            }));
            
            municipioData = Object.entries(municipioMap)
              .map(([municipio, dados]) => ({
                local: municipio,
                coletas: dados.coletas,
                massa: parseFloat(dados.massa.toFixed(2))
              }))
              .sort((a, b) => b.coletas - a.coletas)
              .slice(0, 10);
          }
        }

        // 3. Dados por cliente (para ambos os perfis)
        let clienteQuery = supabase
          .from('coletas')
          .select('cliente_nome, quantidade_coletada');

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
  }, [toast, profile, profileLoading, user]);

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