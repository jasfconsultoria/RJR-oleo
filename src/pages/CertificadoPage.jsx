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
import { ArrowLeft, Loader2, FileText, CheckCircle, User, Search } from 'lucide-react';
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
  periodoInicio: undefined,
  periodoFim: undefined,
  data_emissao: undefined,
  
  // Campos do cliente, agora preenchidos diretamente ou manualmente
  cliente_id: '', // Será preenchido em edição, ou vazio para novos (manual)
  cliente_nome: '',
  cliente_nome_fantasia: '',
  cnpj_cpf: '',
  endereco: '',
  email: '',
  municipio: '',
  estado: '',
  telefone: '',
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
      clearSavedData(); 
      setLocalFormData(initialFormState); 
    } else {
      const currentSavedData = savedData || {}; 
      const dataToLoad = {
        ...currentSavedData,
        periodoInicio: processDateValue(currentSavedData.periodoInicio, getFirstDayOfMonth),
        periodoFim: processDateValue(currentSavedData.periodoFim, getTodayDate),
        data_emissao: processDateValue(currentSavedData.data_emissao, () => new Date()),
        
        // Carregar dados do cliente do auto-save
        cliente_id: currentSavedData.cliente_id || '',
        cliente_nome: currentSavedData.cliente_nome || '',
        cliente_nome_fantasia: currentSavedData.cliente_nome_fantasia || '',
        cnpj_cpf: currentSavedData.cnpj_cpf || '',
        endereco: currentSavedData.endereco || '',
        email: currentSavedData.email || '',
        municipio: currentSavedData.municipio || '',
        estado: currentSavedData.estado || '',
        telefone: currentSavedData.telefone || '',
      };
      setLocalFormData(dataToLoad);
    }
  }, [isEditMode, savedData, setLocalFormData, processDateValue, clearSavedData]);

  const { 
    cliente_id, cliente_nome, cliente_nome_fantasia, cnpj_cpf, endereco, email, municipio, estado, telefone,
    periodoInicio, periodoFim, data_emissao
  } = localFormData;

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

          const { data: clientData, error: clientError } = await supabase
            .from('clientes')
            .select('id, nome, cnpj_cpf, municipio, estado, endereco, nome_fantasia, telefone, email')
            .eq('id', certData.cliente_id)
            .single();

          if (clientError) throw clientError;

          setLocalFormData(prev => ({
            ...prev,
            cliente_id: clientData.id,
            cliente_nome: clientData.nome,
            cliente_nome_fantasia: clientData.nome_fantasia,
            cnpj_cpf: clientData.cnpj_cpf,
            endereco: clientData.endereco,
            email: clientData.email,
            municipio: clientData.municipio,
            estado: clientData.estado,
            telefone: clientData.telefone,
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

  const handleInputChange = (field, value) => {
    setLocalFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!cliente_nome || !cnpj_cpf || !periodoInicio || !periodoFim || !data_emissao) {
      toast({ title: 'Campos obrigatórios', description: 'Por favor, preencha o Nome do Cliente, CNPJ/CPF e todas as datas.', variant: 'destructive' });
      return;
    }
    if (new Date(periodoInicio) > new Date(periodoFim)) {
      toast({ title: 'Período inválido', description: 'A data de início não pode ser posterior à data de fim.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      const startDateISO = formatToISODate(periodoInicio);
      const actualPeriodoFim = periodoFim instanceof Date && isValid(periodoFim) ? periodoFim : new Date();
      const endDateWithTime = format(endOfDay(actualPeriodoFim), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

      // Buscar cliente pelo CNPJ/CPF para obter o ID, se existir
      let currentClienteId = cliente_id;
      let currentClienteNome = cliente_nome;
      let currentClienteNomeFantasia = cliente_nome_fantasia;
      let currentCnpjCpf = cnpj_cpf;
      let currentEndereco = endereco;
      let currentEmail = email;
      let currentMunicipio = municipio;
      let currentEstado = estado;
      let currentTelefone = telefone;

      if (!isEditMode) { // Apenas para novos certificados, tentar encontrar ou criar cliente
        const { data: existingClient, error: clientSearchError } = await supabase
          .from('clientes')
          .select('id, nome, nome_fantasia, cnpj_cpf, endereco, email, municipio, estado, telefone')
          .eq('cnpj_cpf', cnpj_cpf)
          .single();

        if (clientSearchError && clientSearchError.code !== 'PGRST116') { // PGRST116 means no rows found
          throw new Error(`Erro ao buscar cliente existente: ${clientSearchError.message}`);
        }

        if (existingClient) {
          currentClienteId = existingClient.id;
          currentClienteNome = existingClient.nome;
          currentClienteNomeFantasia = existingClient.nome_fantasia;
          currentCnpjCpf = existingClient.cnpj_cpf;
          currentEndereco = existingClient.endereco;
          currentEmail = existingClient.email;
          currentMunicipio = existingClient.municipio;
          currentEstado = existingClient.estado;
          currentTelefone = existingClient.telefone;
        } else {
          // Se não encontrou, o cliente é "novo" para este certificado (mesmo que não seja salvo na tabela clientes)
          // O ID será nulo, e os dados virão do formulário
          toast({
            title: 'Cliente não encontrado',
            description: 'O cliente com este CNPJ/CPF não foi encontrado. Os dados serão usados apenas para o certificado.',
            variant: 'default',
          });
        }
      }

      const { data: coletas, error: coletasError } = await supabase
        .from('coletas')
        .select('quantidade_coletada')
        .eq('cliente_id', currentClienteId) // Usar o ID encontrado ou o que já estava
        .gte('data_coleta', startDateISO)
        .lte('data_coleta', endDateWithTime);

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
        cliente_id: currentClienteId || null, // Pode ser nulo se o cliente não existir no DB
        cliente_nome: currentClienteNome,
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

      setPdfData({
        id: certData.id,
        cliente: { // Reconstruir objeto cliente para o PDF
          id: currentClienteId,
          nome: currentClienteNome,
          cnpj_cpf: currentCnpjCpf,
          municipio: currentMunicipio,
          estado: currentEstado,
          endereco: currentEndereco,
          nome_fantasia: currentClienteNomeFantasia,
          telefone: currentTelefone,
          email: currentEmail,
        },
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
        await logAction('update_certificate', { certificate_id: certData.id, client_id: currentClienteId });
      } else {
        await logAction('generate_certificate', { certificate_id: certData.id, client_id: currentClienteId });
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
                      const newDate = dateString ? parseISO(dateString) : undefined;
                      setLocalFormData(prev => ({ ...prev, data_emissao: isValid(newDate) ? newDate : undefined }));
                    }}
                    disabled={profile?.role !== 'administrador'}
                    className="bg-white/20 border-white/30"
                  />
                </div>
                <div className="md:col-span-2 space-y-2 relative">
                  <Label htmlFor="cliente_nome" className="text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    Nome do Cliente <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="cliente_nome"
                    value={cliente_nome}
                    onChange={(e) => handleInputChange('cliente_nome', e.target.value)}
                    placeholder="Nome completo ou Razão Social do cliente"
                    className="w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="cnpj_cpf">CNPJ/CPF <span className="text-red-500">*</span></Label>
                  <Input
                    id="cnpj_cpf"
                    value={cnpj_cpf}
                    onChange={(e) => handleInputChange('cnpj_cpf', e.target.value)}
                    placeholder="CNPJ ou CPF do cliente"
                    className="bg-white/20 border-white/30 mt-2"
                    required
                  />
                </div>
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