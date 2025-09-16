import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Truck, Droplets, MapPin, User, LayoutDashboard, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProfile } from '@/contexts/ProfileContext';
import { formatNumber } from '@/lib/utils';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalColetas: 0,
    totalMassa: 0,
    coletasPorLocal: [],
    coletasPorMunicipio: [],
    coletasPorColetor: [],
    coletasPorCliente: [],
  });
  const { loading: profileLoading, profile } = useProfile();
  const [dataLoading, setDataLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile) {
        setDataLoading(false);
        return;
      }
      
      setDataLoading(true);
      
      const { data, error } = await supabase.rpc('get_dashboard_data');

      if (error) {
        toast({ title: 'Erro ao buscar dados do dashboard', description: error.message, variant: 'destructive' });
        setDataLoading(false);
        return;
      }

      if (!data) {
        setDataLoading(false);
        return;
      }

      const totalColetas = data.reduce((acc, curr) => acc + (curr.coletas || 0), 0);
      const totalMassa = data.reduce((acc, curr) => acc + (curr.massa || 0), 0);

      let coletasPorMunicipio = [];
      let coletasPorColetor = [];
      let coletasPorCliente = [];

      if (profile.role === 'administrador') {
        const { data: municipioData, error: municipioError } = await supabase.rpc('get_coletas_por_municipio_admin');
        if (municipioError) toast({ title: 'Erro ao buscar coletas por município', description: municipioError.message, variant: 'destructive' });
        else coletasPorMunicipio = municipioData || [];

        const { data: coletorData, error: coletorError } = await supabase.rpc('get_coletas_por_coletor_admin');
        if (coletorError) toast({ title: 'Erro ao buscar coletas por coletor', description: coletorError.message, variant: 'destructive' });
        else coletasPorColetor = coletorData || [];
      }

      const { data: clienteData, error: clienteError } = await supabase.rpc('get_coletas_por_cliente');
      if (clienteError) toast({ title: 'Erro ao buscar coletas por cliente', description: clienteError.message, variant: 'destructive' });
      else coletasPorCliente = clienteData || [];


      setStats({
        totalColetas,
        totalMassa,
        coletasPorLocal: data,
        coletasPorMunicipio,
        coletasPorColetor,
        coletasPorCliente,
      });

      setDataLoading(false);
    };
    
    if (!profileLoading) {
      fetchDashboardData();
    }
  }, [toast, profile, profileLoading]);

  if (profileLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  const chartTitle = profile?.role === 'administrador' ? 'Coletas por Estado' : `Coletas em ${profile?.municipio || 'seu Município'}`;
  const chartDataKey = 'local';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-2 bg-gray-800/80 border border-gray-600 rounded-xl text-white">
          <p className="label font-bold">{`${label}`}</p>
          <p className="text-emerald-400">{`Nº de Coletas : ${payload[0].value}`}</p>
          <p className="text-yellow-400">{`Massa (kg) : ${formatNumber(payload[1].value)}`}</p>
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
                Visão geral e indicadores de performance do sistema.
            </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-300">Total de Coletas</CardTitle>
              <Truck className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalColetas}</div>
              <p className="text-xs text-gray-400">Registros de coletas no sistema</p>
            </CardContent>
          </Card>
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-300">Massa Total Coletada (kg)</CardTitle>
              <Droplets className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats.totalMassa)}</div>
              <p className="text-xs text-gray-400">Quilogramas de óleo coletado</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="text-emerald-300">{chartTitle}</CardTitle>
             <CardDescription className="text-gray-400">
              {profile?.role === 'administrador' 
                ? 'Visualização da performance em cada estado.'
                : 'Performance das coletas no seu município de atuação.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={stats.coletasPorLocal}>
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

        {profile?.role === 'administrador' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-emerald-300 flex items-center gap-2"><MapPin className="h-5 w-5" /> Coletas por Município</CardTitle>
                <CardDescription className="text-gray-400">Performance por município (Top 10).</CardDescription>
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
            <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
              <CardHeader>
                <CardTitle className="text-emerald-300 flex items-center gap-2"><User className="h-5 w-5" /> Coletas por Coletor</CardTitle>
                <CardDescription className="text-gray-400">Performance por coletor (Top 10).</CardDescription>
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
          </div>
        )}

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="text-emerald-300 flex items-center gap-2"><Users className="h-5 w-5" /> Coletas por Cliente</CardTitle>
            <CardDescription className="text-gray-400">
              {profile?.role === 'administrador' 
                ? 'Clientes com maior volume de coleta (Top 10).'
                : 'Seus clientes com maior volume de coleta (Top 10).'
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

      </div>
    </>
  );
};

export default DashboardPage;