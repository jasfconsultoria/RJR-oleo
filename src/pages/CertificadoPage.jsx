import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
import { logAction } from '@/lib/logger';
import { CertificadoViewDialog } from '@/components/certificados/CertificadoViewDialog';

const getTodayDate = () => new Date();
const getFirstDayOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const CertificadoPage = () => {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState(getFirstDayOfMonth());
  const [periodoFim, setPeriodoFim] = useState(getTodayDate());
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCertificado, setGeneratedCertificado] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [clientRes, empresaRes] = await Promise.all([
          supabase.from('clientes').select('id, nome, cnpj_cpf, municipio, estado, endereco').order('nome', { ascending: true }),
          supabase.from('empresa').select('*').single(),
        ]);

        if (clientRes.error) throw clientRes.error;
        setClients(clientRes.data || []);

        if (empresaRes.error) throw empresaRes.error;
        setEmpresa(empresaRes.data);
      } catch (error) {
        toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [toast]);

  const handleGenerate = async () => {
    if (!selectedClientId || !periodoInicio || !periodoFim) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, selecione um cliente e o período.', variant: 'destructive' });
      return;
    }
    if (periodoInicio > periodoFim) {
      toast({ title: 'Período inválido', description: 'A data de início não pode ser posterior à data de fim.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data: coletas, error: coletasError } = await supabase
        .from('coletas')
        .select('quantidade_coletada')
        .eq('cliente_id', selectedClientId)
        .gte('data_coleta', periodoInicio.toISOString().split('T')[0])
        .lte('data_coleta', periodoFim.toISOString().split('T')[0]);

      if (coletasError) throw coletasError;

      const totalKg = coletas.reduce((acc, coleta) => acc + (coleta.quantidade_coletada || 0), 0);
      if (totalKg === 0) {
        toast({ title: 'Nenhuma coleta encontrada', description: 'Não há coletas para o cliente no período selecionado.', variant: 'destructive' });
        setIsGenerating(false);
        return;
      }

      const selectedClient = clients.find(c => c.id === selectedClientId);
      const dataEmissao = new Date();

      const { data: certData, error: certError } = await supabase
        .from('certificados')
        .insert({
          cliente_id: selectedClientId,
          cliente_nome: selectedClient.nome,
          periodo_inicio: periodoInicio.toISOString().split('T')[0],
          periodo_fim: periodoFim.toISOString().split('T')[0],
          total_kg: totalKg,
          data_emissao: dataEmissao.toISOString(),
        })
        .select()
        .single();

      if (certError) throw certError;

      await logAction('generate_certificate', { certificate_id: certData.id, client_id: selectedClientId });
      toast({ title: 'Certificado gerado com sucesso!' });

      navigate(`/app/certificados/view/${certData.id}`);

    } catch (error) {
      toast({ title: 'Erro ao gerar certificado', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Emissão de Certificados - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto p-4 md:p-8"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <FileText className="w-8 h-8 text-emerald-400" />
              Emissão de Certificados
            </CardTitle>
            <CardDescription className="text-emerald-200/80">
              Gere certificados de destinação de óleo para seus clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">
            <div>
              <Label htmlFor="cliente" className="block mb-2">Cliente *</Label>
              <ClienteSearchableSelect
                value={selectedClientId}
                onChange={setSelectedClientId}
                loading={loading}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="periodo-inicio" className="block mb-2">Período Início *</Label>
                <DatePicker date={periodoInicio} setDate={setPeriodoInicio} />
              </div>
              <div>
                <Label htmlFor="periodo-fim" className="block mb-2">Período Fim *</Label>
                <DatePicker date={periodoFim} setDate={setPeriodoFim} />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between p-4 md:p-6">
            <Button
              type="button"
              onClick={() => navigate(-1)}
              variant="outline"
              className="w-auto rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 mr-2" />
              )}
              Gerar
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </>
  );
};

export default CertificadoPage;