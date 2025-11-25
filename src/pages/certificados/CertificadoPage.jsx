import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ArrowLeft, Loader2, FileText, CheckCircle, User } from 'lucide-react';
import { logAction } from '@/lib/logger';
import { formatToISODate, formatCnpjCpf } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, isValid, parseISO, endOfDay } from 'date-fns';
import CertificadoPDF from '@/components/certificados/CertificadoPDF';
import { Progress } from '@/components/ui/progress';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useProfile } from '@/contexts/ProfileContext';

const getTodayDate = () => new Date();
const getFirstDayOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const initialFormState = {
  periodoInicio: getFirstDayOfMonth(),
  periodoFim: getTodayDate(),
  data_emissao: new Date(),
  
  cliente_id: '',
  cliente_nome: '',
  cliente_nome_fantasia: '',
  cnpj_cpf: '',
  endereco: '',
  email: '',
  municipio: '',
  estado: '',
  telefone: '',
  cliente: '',
};

const CertificadoPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useProfile();

  const isEditMode = !!id;
  const pdfContainerRef = useRef(null);

  // ✅ IMPLEMENTAÇÃO IDÊNTICA AO CLIENTEFORM
  const autoSaveKey = id ? `certificadoForm_edit_${id}` : `certificadoForm_new`;
  const [formData, setFormData, clearSavedData] = useAutoSave(
    autoSaveKey,
    initialFormState,
    true // ✅ SEMPRE carregar do auto-save
  );

  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);
  const [pdfData, setPdfData] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [allClients, setAllClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [isClienteSelected, setIsClienteSelected] = useState(false);

  const { 
    cliente_id, 
    cliente_nome, 
    cliente_nome_fantasia, 
    cnpj_cpf, 
    endereco, 
    email, 
    municipio, 
    estado, 
    telefone,
    periodoInicio, 
    periodoFim, 
    data_emissao, 
    cliente 
  } = formData;

  // ✅ VERIFICAÇÃO DE AUTO-SAVE IDÊNTICA AO CLIENTEFORM
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(autoSaveKey);
      setHasAutoSaveData(!!saved);
    }
  }, [autoSaveKey, formData]);

  const processDateValue = useCallback((dateValue, defaultValueFn) => {
    if (typeof dateValue === 'string') {
      const parsed = parseISO(dateValue);
      return isValid(parsed) ? parsed : defaultValueFn();
    }
    return (dateValue instanceof Date && isValid(dateValue)) ? dateValue : defaultValueFn();
  }, []);

  // Carregar dados iniciais - SIMPLIFICADO
  useEffect(() => {
    if (isEditMode) {
      // No modo edição, limpa o auto-save e busca do banco
      clearSavedData();
      setHasAutoSaveData(false);
    }
    // No modo novo, o useAutoSave já carrega automaticamente
  }, [isEditMode, clearSavedData]);

  // Buscar todos os clientes com contratos ativos - CORRIGIDO
  useEffect(() => {
    const fetchAllClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*, contratos(status)')
          .order('razao_social', { ascending: true }); // CORRIGIDO: ordenar por razao_social

        if (error) throw error;

        const activeClients = (data || []).filter(client => 
          client.contratos && client.contratos.some(contract => contract.status === 'Ativo')
        );
        
        setAllClients(activeClients);
        setFilteredClients(activeClients);
      } catch (error) {
        toast({ 
          title: 'Erro ao buscar clientes', 
          description: error.message, 
          variant: 'destructive' 
        });
        setAllClients([]);
        setFilteredClients([]);
      }
    };
    
    fetchAllClients();
  }, [toast]);

  // Filtrar clientes baseado no termo de busca - CORRIGIDO
  useEffect(() => {
    if (cliente && cliente.trim()) {
      const searchTerm = cliente.toLowerCase();
      const filtered = allClients.filter(client =>
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm)) ||
        (client.razao_social && client.razao_social.toLowerCase().includes(searchTerm)) || // CORRIGIDO
        (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(searchTerm))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(allClients);
    }
  }, [cliente, allClients]);

  // Buscar dados para edição - CORRIGIDO
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!isEditMode) return;
      
      setLoading(true);
      try {
        // Buscar dados da empresa
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresa')
          .select('*')
          .single();
        
        if (empresaError) throw empresaError;
        setEmpresa(empresaData);

        // Buscar dados do certificado
        const { data: certData, error: certError } = await supabase
          .from('certificados')
          .select('cliente_id, periodo_inicio, periodo_fim, data_emissao')
          .eq('id', id)
          .single();
        
        if (certError) throw certError;

        // Buscar dados do cliente - CORRIGIDO
        const { data: clientData, error: clientError } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj_cpf, municipio, estado, endereco, telefone, email') // CORRIGIDO
          .eq('id', certData.cliente_id)
          .single();

        if (clientError) throw clientError;

        // Atualizar formulário com dados do cliente - CORRIGIDO
        setFormData(prev => ({
          ...prev,
          cliente_id: clientData.id,
          cliente_nome: clientData.razao_social, // CORRIGIDO
          cliente_nome_fantasia: clientData.nome_fantasia || '',
          cnpj_cpf: clientData.cnpj_cpf,
          endereco: clientData.endereco || '',
          email: clientData.email || '',
          municipio: clientData.municipio,
          estado: clientData.estado,
          telefone: clientData.telefone || '',
          // CORRIGIDO: exibir Nome Fantasia - Razão Social
          cliente: clientData.nome_fantasia && clientData.razao_social 
            ? `${clientData.nome_fantasia} - ${clientData.razao_social}`
            : clientData.nome_fantasia || clientData.razao_social,
          periodoInicio: processDateValue(certData.periodo_inicio, getFirstDayOfMonth),
          periodoFim: processDateValue(certData.periodo_fim, getTodayDate),
          data_emissao: processDateValue(certData.data_emissao, () => new Date()),
        }));
        
        setIsClienteSelected(true);
      } catch (error) {
        toast({ 
          title: 'Erro ao carregar dados', 
          description: error.message, 
          variant: 'destructive' 
        });
        navigate('/app/certificados');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [id, isEditMode, toast, navigate, setFormData, processDateValue]);

  // Buscar dados da empresa para novo certificado
  useEffect(() => {
    const fetchEmpresa = async () => {
      if (!isEditMode) {
        try {
          const { data: empresaData, error: empresaError } = await supabase
            .from('empresa')
            .select('*')
            .single();
          
          if (!empresaError) {
            setEmpresa(empresaData);
          }
        } catch (error) {
          console.error('Erro ao carregar dados da empresa:', error);
        }
      }
    };

    fetchEmpresa();
  }, [isEditMode]);

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handler para seleção de cliente - CORRIGIDO
  const handleClientSelect = (client) => {
    const newFormData = {
      cliente_id: client.id,
      cliente_nome: client.razao_social, // CORRIGIDO
      cliente_nome_fantasia: client.nome_fantasia || '',
      cnpj_cpf: client.cnpj_cpf,
      endereco: client.endereco || '',
      email: client.email || '',
      municipio: client.municipio,
      estado: client.estado,
      telefone: client.telefone || '',
      // CORRIGIDO: exibir Nome Fantasia - Razão Social
      cliente: client.nome_fantasia && client.razao_social 
        ? `${client.nome_fantasia} - ${client.razao_social}`
        : client.nome_fantasia || client.razao_social,
    };

    setFormData(prev => ({ ...prev, ...newFormData }));
    setShowClienteDropdown(false);
    setIsClienteSelected(true);
  };

  // ✅ FUNÇÃO PARA DESCARTAR ALTERAÇÕES E VOLTAR
  const handleDiscardChanges = () => {
    clearSavedData();
    setFormData(initialFormState);
    setHasAutoSaveData(false);
    navigate('/app/certificados');
  };

  const handleSubmit = async () => {
    // Validações
    if (!cliente_id || !periodoInicio || !periodoFim || !data_emissao) {
      toast({ 
        title: 'Campos obrigatórios', 
        description: 'Por favor, selecione um cliente e preencha todas as datas.', 
        variant: 'destructive' 
      });
      return;
    }

    if (new Date(periodoInicio) > new Date(periodoFim)) {
      toast({ 
        title: 'Período inválido', 
        description: 'A data de início não pode ser posterior à data de fim.', 
        variant: 'destructive' 
      });
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      // Buscar coletas do período
      const startDateISO = formatToISODate(periodoInicio);
      const actualPeriodoFim = periodoFim instanceof Date && isValid(periodoFim) ? periodoFim : new Date();
      const endDateWithTime = format(endOfDay(actualPeriodoFim), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");

      const { data: coletas, error: coletasError } = await supabase
        .from('coletas')
        .select('quantidade_coletada')
        .eq('cliente_id', cliente_id)
        .gte('data_coleta', startDateISO)
        .lte('data_coleta', endDateWithTime);

      if (coletasError) throw coletasError;
      setProgress(20);

      // Calcular total de kg
      const totalKg = coletas.reduce((acc, coleta) => acc + (coleta.quantidade_coletada || 0), 0);
      
      if (totalKg === 0) {
        toast({ 
          title: 'Nenhuma coleta encontrada', 
          description: 'Não há coletas para o cliente no período selecionado.', 
          variant: 'destructive' 
        });
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      // Preparar dados do certificado
      const certificateData = {
        cliente_id: cliente_id,
        cliente_nome: cliente_nome,
        periodo_inicio: formatToISODate(periodoInicio),
        periodo_fim: formatToISODate(periodoFim),
        total_kg: totalKg,
        data_emissao: data_emissao.toISOString(),
      };

      // Salvar no banco
      let certData;
      if (isEditMode) {
        const { data, error } = await supabase
          .from('certificados')
          .update(certificateData)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        certData = data;
      } else {
        const { data, error } = await supabase
          .from('certificados')
          .insert(certificateData)
          .select()
          .single();
        
        if (error) throw error;
        certData = data;
      }

      setProgress(40);

      // Preparar dados para PDF
      setPdfData({
        id: certData.id,
        cliente: {
          id: cliente_id,
          nome: cliente_nome,
          cnpj_cpf: cnpj_cpf,
          municipio: municipio,
          estado: estado,
          endereco: endereco,
          nome_fantasia: cliente_nome_fantasia,
          telefone: telefone,
          email: email,
        },
        empresa: empresa,
        periodo: { inicio: certData.periodo_inicio, fim: certData.periodo_fim },
        totalKg: certData.total_kg,
        data_emissao: certData.data_emissao,
      });

      // Aguardar renderização do PDF
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(60);

      // Gerar PDF
      const input = pdfContainerRef.current?.firstChild;
      if (!input) throw new Error('Falha ao renderizar o componente do PDF.');

      const canvas = await html2canvas(input, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true, 
        backgroundColor: '#ffffff' 
      });
      
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

      // Upload do PDF
      const pdfBlob = pdf.output('blob');
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const fileName = `certificados/Certificado_${certData.id.substring(0, 8)}_${dateStr}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from('certificados')
        .upload(fileName, pdfBlob, { cacheControl: '3600', upsert: true });
      
      if (uploadError) throw uploadError;
      setProgress(80);

      // Atualizar URL do PDF no banco
      const { data: urlData } = supabase.storage.from('certificados').getPublicUrl(fileName);
      
      const { error: dbError } = await supabase
        .from('certificados')
        .update({ pdf_url: urlData.publicUrl })
        .eq('id', certData.id);
      
      if (dbError) throw dbError;
      setProgress(90);

      // Log da ação
      if (isEditMode) {
        await logAction('update_certificate', { certificate_id: certData.id, client_id: cliente_id });
      } else {
        await logAction('generate_certificate', { certificate_id: certData.id, client_id: cliente_id });
        clearSavedData();
        setHasAutoSaveData(false);
      }

      setProgress(100);

      // Sucesso
      toast({
        title: 'Certificado Gerado com Sucesso!',
        description: 'O certificado foi salvo no sistema.',
        variant: 'success',
        duration: 10000,
        action: (
          <ToastAction 
            altText="Abrir PDF" 
            onClick={() => {
              const url = `${urlData.publicUrl}?t=${new Date().getTime()}`;
              window.open(url, '_blank');
            }}
          >
            Abrir PDF
          </ToastAction>
        ),
      });

      // Redirecionar
      setTimeout(() => {
        navigate('/app/certificados');
      }, 1500);

    } catch (error) {
      console.error('Erro:', error);
      toast({ 
        title: `Erro ao ${isEditMode ? 'atualizar' : 'gerar'} certificado`, 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

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
          {/* Overlay de carregamento */}
          {isGenerating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-center items-center z-20 rounded-xl p-8 outline-none">
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
                {/* ✅ INDICADOR DE ALTERAÇÕES NÃO SALVAS */}
                {hasAutoSaveData && (
                  <span className="text-sm text-yellow-400 ml-2">(Alterações não salvas)</span>
                )}
              </CardTitle>
              <CardDescription className="text-emerald-200/80">
                {isEditMode 
                  ? 'Altere os dados do certificado e gere um novo PDF.' 
                  : 'Gere certificados de destinação de óleo para seus clientes.'
                }
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data de Emissão */}
                <div className="md:col-span-2">
                  <Label htmlFor="data_emissao" className="block mb-2">Data de Emissão *</Label>
                  <Input
                    type="date"
                    id="data_emissao"
                    value={data_emissao ? formatToISODate(data_emissao) : ''}
                    onChange={(e) => {
                      const dateString = e.target.value;
                      const newDate = dateString ? parseISO(dateString) : new Date();
                      setFormData(prev => ({ 
                        ...prev, 
                        data_emissao: isValid(newDate) ? newDate : new Date() 
                      }));
                    }}
                    disabled={profile?.role !== 'administrador'}
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
                  />
                </div>
                
                {/* Seletor de Cliente - CORRIGIDO */}
                <div className="md:col-span-2 space-y-2 relative">
                  <Label htmlFor="cliente" className="text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-400" />
                    Cliente (com contrato ativo) *
                  </Label>
                  <Input
                    id="cliente"
                    value={cliente}
                    onChange={(e) => handleInputChange('cliente', e.target.value)}
                    onFocus={() => setShowClienteDropdown(true)}
                    onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                    placeholder="Digite para buscar..."
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
                    autoComplete="off"
                    required
                  />
                  
                  {/* Dropdown de clientes - CORRIGIDO */}
                  {showClienteDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute z-10 w-full bg-white rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1"
                    >
                      {filteredClients.length > 0 ? (
                        filteredClients.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleClientSelect(client)}
                            className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">
                              {/* CORRIGIDO: exibir Nome Fantasia - Razão Social */}
                              {client.nome_fantasia && client.razao_social 
                                ? `${client.nome_fantasia} - ${client.razao_social}`
                                : client.nome_fantasia || client.razao_social}
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatCnpjCpf(client.cnpj_cpf)} - {client.municipio}/{client.estado}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-gray-500">
                          {cliente ? 'Nenhum cliente encontrado.' : 'Nenhum cliente com contrato ativo encontrado.'}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
                
                {/* Dados do cliente selecionado */}
                {cliente_id && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg">
                    <div>
                      <Label htmlFor="cnpj_cpf" className="text-emerald-300">CNPJ/CPF</Label>
                      <Input
                        id="cnpj_cpf"
                        value={formatCnpjCpf(cnpj_cpf)}
                        disabled
                        className="bg-white/10 border-white/20 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone" className="text-emerald-300">Telefone</Label>
                      <Input
                        id="telefone"
                        value={telefone}
                        disabled
                        className="bg-white/10 border-white/20 mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Período da Coleta */}
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
                        const newDate = dateString ? parseISO(dateString) : getFirstDayOfMonth();
                        setFormData(prev => ({ 
                          ...prev, 
                          periodoInicio: isValid(newDate) ? newDate : getFirstDayOfMonth() 
                        }));
                      }}
                      className="bg-white/5 border-white/20 text-white rounded-xl"
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
                        const newDate = dateString ? parseISO(dateString) : getTodayDate();
                        setFormData(prev => ({ 
                          ...prev, 
                          periodoFim: isValid(newDate) ? newDate : getTodayDate() 
                        }));
                      }}
                      className="bg-white/5 border-white/20 text-white rounded-xl"
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
                className="w-auto rounded-xl border-white/20 text-white hover:bg-white/10"
                disabled={isGenerating}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Voltar
              </Button>
              
              <div className="flex gap-2">
                {/* ✅ BOTÃO DESCARTAR ALTERAÇÕES - AGORA VOLTA PARA A LISTA */}
                {hasAutoSaveData && (
                  <Button 
                    type="button"
                    onClick={handleDiscardChanges}
                    variant="outline"
                    className="rounded-xl h-8 px-2 text-xs text-yellow-400 border-yellow-400"
                  >
                    Descartar Alterações
                  </Button>
                )}
                
                <Button
                  onClick={handleSubmit}
                  disabled={isGenerating || !cliente_id || !periodoInicio || !periodoFim || !data_emissao}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                >
                  {isGenerating ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5 mr-2" />
                  )}
                  {isEditMode ? 'Atualizar Certificado' : 'Gerar Certificado'}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </motion.div>

      {/* Container oculto para geração do PDF */}
      <div ref={pdfContainerRef} style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
        {pdfData && empresa && <CertificadoPDF data={pdfData} empresa={empresa} />}
      </div>
    </>
  );
};

export default CertificadoPage;