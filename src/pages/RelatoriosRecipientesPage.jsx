import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Loader2, Box, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatNumber } from '@/lib/utils';

const RelatoriosRecipientesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecipientesReport = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_recipientes_report');

    if (error) {
      toast({ title: 'Erro ao buscar relatório de recipientes', description: error.message, variant: 'destructive' });
      setReportData([]);
    } else {
      setReportData(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchRecipientesReport();
  }, [fetchRecipientesReport]);

  const getClientDisplayName = (client) => {
    if (!client) return 'Cliente não especificado';
    // Corrigido para exibir Nome Fantasia - Razão Social, assumindo inversão semântica dos campos no DB
    return client.cliente_nome ? `${client.cliente_nome} - ${client.cliente_nome_fantasia}` : client.cliente_nome_fantasia;
  };

  return (
    <>
      <Helmet><title>Relatório de Recipientes - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Box className="w-8 h-8 text-emerald-400" /> Relatório de Recipientes
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize a quantidade de recipientes ativos por cliente.</p>
          </div>
          <Button onClick={() => toast({ title: 'Funcionalidade em desenvolvimento', description: 'A exportação para Excel será implementada em breve.', variant: 'default' })} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            Exportar
          </Button>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <TableHead className="p-2 text-left text-white">Cliente</TableHead>
                    <TableHead className="p-2 text-right text-white">Total de Recipientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.length > 0 ? (
                    reportData.map(item => (
                      <TableRow key={item.cliente_id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Cliente" className="font-medium">{getClientDisplayName(item)}</TableCell>
                        <TableCell data-label="Total de Recipientes" className="text-right">{formatNumber(item.total_recipientes)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan="2" className="text-center text-gray-400 py-10">Nenhum dado de recipiente encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
        <div className="flex justify-start items-center pt-6 mt-4">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              variant="outline"
              className="w-auto rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Voltar
            </Button>
          </div>
      </div>
    </>
  );
};

export default RelatoriosRecipientesPage;