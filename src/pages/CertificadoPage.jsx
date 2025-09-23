import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import CertificadoClientSearch from '@/components/certificados/CertificadoClientSearch'; // Importar o novo componente
import { ArrowLeft, Loader2, FileText, CheckCircle } from 'lucide-react';
import { logAction } from '@/lib/logger';
import { formatToISODate, formatCnpjCpf } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, isValid, parseISO, endOfDay } from 'date-fns';
import CertificadoPDF from '@/components/CertificadoPDF';
import { Progress } from '@/components/ui/progress';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useProfile } from '@/contexts/ProfileContext';

const getTodayDate = () => new Date();
const getFirstDayOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const initialFormState = {
  selectedClientId: '',
  selectedClientData: null, // Novo estado para armazenar o objeto completo do cliente
  periodoInicio: undefined, // Default to undefined
  periodoFim: undefined,    // Default to undefined
  data_emissao: undefined,  // Default to undefined
};

const CertificadoPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useProfile();

  const isEditMode = !!id;

  const pdfContainerRef = useRef(null);
  const [pdfData, setPdfData] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const [localFormData, setLocalFormData, clearSavedData, savedData] = useAutoSave(
    'certificado-form-data',
    initialFormState,
    !isEditMode 
  );

  // Helper to process date values from auto-save or defaults
  const processDateValue = useCallback((dateValue, defaultValueFn) => {
    if (typeof dateValue === 'string') {
      const parsed = parseISO(dateValue);
      return isValid(parsed) ? parsed : defaultValueFn();
    }
    return (dateValue instanceof Date && isValid(dateValue)) ? dateValue : defaultValueFn();
  }, []);

  useEffect(() => {
    if (isEditMode) {
      setLocalFormData(initialFormState);
    } else {
      const currentSavedData = savedData || {}; 
      const dataToLoad = {
        ...currentSavedData,
        selectedClientId: currentSavedData.selectedClientId || '',
        selectedClientData: currentSavedData.selectedClientData || null, // Carregar dados do cliente
        periodoInicio: processDateValue(currentSavedData.periodoInicio, getFirstDayOfMonth),
        periodoFim: processDateValue(currentSavedData.periodoFim, getTodayDate),
        data_emissao: processDateValue(currentSavedData.data_emissao, () => new Date()),
      };
      setLocalFormData(dataToLoad);
    }
  }, [isEditMode, savedData, setLocalFormData, processDateValue]);

  const { selectedClientId, selectedClientData, periodoInicio, periodoFim, data_emissao } = localFormData;

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('*').single();
        if (empresaError) throw empresaError;
        setEmpresa(empresaData);

        if (isEditMode) {
          const { data: certData, error: certError } = await supabase
            .from('certificados')
            .select('cliente_id, periodo_inicio, periodo_fim, data_emissao')
            .eq('id', id)
            .single();
          
          if (certError) throw certError;

          // Buscar dados completos do cliente para preencher selectedClientData
          const { data: clientData, error: clientError } = await supabase
            .from('clientes')
            .select('id, nome, cnpj_cpf, municipio, estado, endereco, nome_fantasia')
            .eq('id', certData.cliente_id)
            .single();

          if (clientError) throw clientError;

          setLocalFormData(prev => ({
            ...prev,
            selectedClientId: certData.cliente_id,
            selectedClientData: clientData, // Preencher com os dados completos
            periodoInicio: processDateValue(certData.periodo_inicio, getFirstDayOfMonth),
            periodoFim: processDateValue(certData.periodo_fim, getTodayDate),
            data_emissao: processDateValue(certData.data_emissao, () => new Date()),
          }));
        }
      } catch (error) {
        toast({ title: 'Erro ao carregar dados', description: error.message, variant: 'destructive' });
        if (isEditMode) navigate('/app/certificados');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, [id, isEditMode, toast, navigate, setLocalFormData, processDateValue]);

  const handleClientSelect = (client) => {
    setLocalFormData(prev => ({
      ...prev,
      selectedClientId: client ? client.id : null,
      selectedClientData: client, // Armazenar o objeto completo do cliente
    }));
  };

  const handleSubmit = async () => {
    if (!selectedClientId || !periodoInicio || !periodoFim || !data_emissao || !selectedClientData) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, selecione um cliente e preencha todas as datas.', variant: 'destructive' });
      return;
    }
    if (new Date(periodoInicio) > new Date(periodoFim)) {
      toast({ title: 'Período inválido', description: 'A data de início não pode ser posterior à data de fim.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      const startDateISO = formatToISODate(periodoInicio); // Ex: '2025-09-01'
      
      // Garante que periodoFim é um objeto Date válido antes de usar endOfDay
      const actualPeriodoFim = periodoFim instanceof Date && isValid(periodoFim) ? periodoFim : new Date();
      // Formata a data final para incluir o final do dia no fuso horário da empresa
      const endDateWithTime = format(endOfDay(actualPeriodoFim), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

      const { data: coletas, error: coletasError } = await supabase
        .from('coletas')
        .select('quantidade_coletada')
        .eq('cliente_id', selectedClientId)
        .gte('data_coleta', startDateISO)
        .lte('data_coleta', endDateWithTime); // Usar a data final formatada corretamente

      if (coletasError) throw coletasError;
      setProgress(20);

      const totalKg = coletas.reduce((acc, coleta) => acc + (coleta.quantidade_coletada || 0), 0);
      if (totalKg === 0) {
        toast({ title: 'Nenhuma coleta encontrada', description: 'Não há coletas para o cliente no período selecionado.', variant: 'destructive' });
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      const certificateData = {
        cliente_id: selectedClientId,
        cliente_nome: selectedClientData.nome, // Usar nome do selectedClientData
        periodo_inicio: formatToISODate(periodoInicio),
        periodo_fim: formatToISODate(periodoFim),
        total_kg: totalKg,
        data_emissao: data_emissao.toISOString(),
      };

      let certData, certError;

      if (isEditMode) {
        const { data, error } = await supabase.from('certificados').update(certificateData).eq('id', id).select().single();
        certData = data; certError = error;
      } else {
        const { data, error } = await supabase.from('certificados').insert(certificateData).select().single();
        certData = data; certError = error;
      }

      if (certError) throw certError;
      setProgress(40);

      // Reutilizar selectedClientData e empresa que já estão no estado
      setPdfData({
        id: certData.id,
        cliente: selectedClientData, // Passar o objeto completo do cliente
        empresa: empresa,
        periodo: { inicio: certData.periodo_inicio, fim: certData.periodo_fim },
        totalKg: certData.total_kg,
        data_emissao: certData.data_emissao,
      });

      await new Promise(resolve => setTimeout(resolve, 200));
      
      const input = pdfContainerRef.current.firstChild;
      if (!input) throw new Error('Falha ao renderizar o componente do PDF.');
      
      const canvas = await html2canvas(input, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
      setProgress(70);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      const pdfBlob = pdf.output('blob');
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const fileName = `certificados/Certificado_${certData.id.substring(0, 8)}_${dateStr}.pdf`;

      const { error: uploadError } = await supabase.storage.from('certificados').upload(fileName, pdfBlob, { cacheControl: '3600', upsert: true });
      if (uploadError) throw uploadError;
      setProgress(90);

      const { data: urlData } = supabase.storage.from('certificados').getPublicUrl(fileName);
      
      const { error: dbError } = await supabase.from('certificados').update({ pdf_url: urlData.publicUrl }).eq('id', certData.id);
      if (dbError) throw dbError;
      setProgress(100);

      if (isEditMode) {
        await logAction('update_certificate', { certificate_id: certData.id, client_id: selectedClientId });
      } else {
        await logAction('generate_certificate', { certificate_id: certData.id, client_id: selectedClientId });
        clearSavedData();
      }
      
      toast({
        title: 'Certificado Gerado com Sucesso!',
        description: 'O certificado foi salvo no sistema.',
        variant: 'success',
        duration: 10000,
        action: (
          <ToastAction altText="Abrir PDF" onClick={() => {
            const url = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            window.open(url, '_blank');
          }}>
            Abrir PDF
          </ToastAction>
        ),
      });

      setTimeout(() => {
        navigate('/app/certificados');
      }, 800);

    } catch (error) {
      toast({ title: `Erro ao ${isEditMode ? 'atualizar' : 'gerar'} certificado`, description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
      setPdfData(null);
      setProgress(0);
    }
  };

  return (
    <>
      <Helmet>
        <title>{isEditMode ? 'Editar' : 'Emissão de'} Certificado - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto p-4 md:p-8"
      >
        <div className="relative">
          {isGenerating && (
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-center items-center z-20 rounded-xl p-8 outline-none"
            >
              {progress < 100 ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  <p className="text-white mt-4 text-lg">Gerando e salvando...</p>
                  <p className="text-emerald-300 text-sm mb-4">Por favor, aguarde.</p>
                </>
              ) : (
                <>
                  <CheckCircle className="w-10 h-10 text-emerald-400" />
                  <p className="text-white mt-4 text-lg">Concluído!</p>
                </>
              )}
              <Progress value={progress} className="w-3/4 mt-4" />
            </div>
          )}
          <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <FileText className="w-8 h-8 text-emerald-400" />
                {isEditMode ? 'Editar' : 'Emissão de'} Certificado
              </CardTitle>
              <CardDescription className="text-emerald-200/80">
                {isEditMode ? 'Altere os dados do certificado e gere um novo PDF.' : 'Gere certificados de destinação de óleo para seus clientes.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="data_emissao" className="block mb-2">Data de Emissão *</Label>
                  <Input
                    type="date"
                    id="data_emissao"
                    value={data_emissao ? formatToISODate(data_emissao) : ''}
                    onChange={(e) => {
                      const dateString = e.target.value;
                      // Use parseISO para analisar a string e isValid para verificar
                      const newDate = dateString ? parseISO(dateString) : undefined;
                      setLocalFormData(prev => ({ ...prev, data_emissao: isValid(newDate) ? newDate : undefined }));
                    }}
                    disabled={profile?.role !== 'administrador'}
                    className="bg-white/20 border-white/30"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="cliente" className="block mb-2">Cliente *</Label>
                  <CertificadoClientSearch // Usar o novo componente
                    selectedClientId={selectedClientId}
                    onSelectClient={handleClientSelect}
                    loading={loading}
                  />
                </div>
                {selectedClientData && ( // Usar selectedClientData
                  <div className="md:col-span-2">
                    <Label htmlFor="cnpj_cpf">CNPJ/CPF</Label>
                    <Input
                      id="cnpj_cpf"
                      value={formatCnpjCpf(selectedClientData.cnpj_cpf)}
                      disabled
                      className="bg-white/20 border-white/30 mt-2"
                    />
                  </div>
                )}
              </div>
              <div className="border border-white/20 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-emerald-300 mb-4">Período da Coleta</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="periodo-inicio" className="block mb-2">Período Início *</Label>
                    <Input
                      type="date"
                      id="periodo-inicio"
                      value={periodoInicio ? formatToISODate(periodoInicio) : ''}
                      onChange={(e) => {
                        const dateString = e.target.value;
                        // Use parseISO para analisar a string e isValid para verificar
                        const newDate = dateString ? parseISO(dateString) : undefined;
                        setLocalFormData(prev => ({ ...prev, periodoInicio: isValid(newDate) ? newDate : undefined }));
                      }}
                      className="bg-white/20 border-white/30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="periodo-fim" className="block mb-2">Período Fim *</Label>
                    <Input
                      type="date"
                      id="periodo-fim"
                      value={periodoFim ? formatToISODate(periodoFim) : ''}
                      onChange={(e) => {
                        const dateString = e.target.value;
                        // Use parseISO para analisar a string e isValid para verificar
                        const newDate = dateString ? parseISO(dateString) : undefined;
                        setLocalFormData(prev => ({ ...prev, periodoFim: isValid(newDate) ? newDate : undefined }));
                      }}
                      className="bg-white/20 border-white/30"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between p-4 md:p-6">
              <Button
                type="button"
                onClick={() => navigate('/app/certificados')}
                variant="outline"
                className="w-auto rounded-xl"
                disabled={isGenerating}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isGenerating || loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-5 h-5 mr-2" />
                )}
                {isEditMode ? 'Atualizar Certificado' : 'Gerar Certificado'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </motion.div>
      <div ref={pdfContainerRef} style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
        {pdfData && empresa && <CertificadoPDF data={pdfData} empresa={empresa} />}
      </div>
    </>
  );
};

export default CertificadoPage;