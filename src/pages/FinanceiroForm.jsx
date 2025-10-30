import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, DollarSign, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/logger';
import { unmask, parseCurrency } from '@/lib/utils';
import { format, addDays, parseISO, isValid } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { FinanceiroFormFields } from '@/components/financeiro/FinanceiroFormFields';
import { InstallmentDetails } from '@/components/financeiro/InstallmentDetails';
import { useAutoSave } from '@/hooks/useAutoSave';

const FinanceiroForm = ({ type }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id);
  const downPaymentInputRef = useRef(null);

  const hasFetchedInitialData = useRef(false);
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);

  // Estado do modal de novo cliente/fornecedor
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // ✅ Auto-save
  const getInitialFormData = useCallback(() => ({
    document_number: '',
    issue_date: new Date().toISOString(),
    model: 'Recibo',
    pessoa_id: null,
    cliente_fornecedor_name: '',
    cliente_fornecedor_fantasy_name: '',
    cnpj_cpf: '',
    description: '',
    total_value: '',
    payment_method: 'pix',
    cost_center: 'ADMINISTRAÇÃO',
    notes: '',
    down_payment: '0,00',
    installments_number: 0,
    installments: [],
    single_due_date: addDays(new Date(), 30).toISOString(),
  }), []);

  const autoSaveKey = id ? `financeiroForm_edit_${id}` : `financeiroForm_new_${type}`;
  
  const [rawFormData, setRawFormData, clearSavedData] = useAutoSave(
    autoSaveKey,
    getInitialFormData(),
    true
  );

  // Verificar se há dados no auto-save
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(autoSaveKey);
      setHasAutoSaveData(!!saved && saved !== 'null' && saved !== 'undefined');
    }
  }, [autoSaveKey]);

  // Process rawFormData para obter Date objects
  const formData = useMemo(() => {
    const processed = { ...rawFormData };
    
    // Garantir que todas as propriedades existam
    const safeData = {
      document_number: processed?.document_number || '',
      issue_date: processed?.issue_date || new Date().toISOString(),
      model: processed?.model || 'Recibo',
      pessoa_id: processed?.pessoa_id || null,
      cliente_fornecedor_name: processed?.cliente_fornecedor_name || '',
      cliente_fornecedor_fantasy_name: processed?.cliente_fornecedor_fantasy_name || '',
      cnpj_cpf: processed?.cnpj_cpf || '',
      description: processed?.description || '',
      total_value: processed?.total_value || '',
      payment_method: processed?.payment_method || 'pix',
      cost_center: processed?.cost_center || 'ADMINISTRAÇÃO',
      notes: processed?.notes || '',
      down_payment: processed?.down_payment || '0,00',
      installments_number: processed?.installments_number || 0,
      installments: processed?.installments || [],
      single_due_date: processed?.single_due_date || addDays(new Date(), 30).toISOString(),
    };

    // Processar datas
    if (typeof safeData.issue_date === 'string') {
      const parsed = parseISO(safeData.issue_date);
      safeData.issue_date = isValid(parsed) ? parsed : new Date();
    }
    if (typeof safeData.single_due_date === 'string') {
      const parsed = parseISO(safeData.single_due_date);
      safeData.single_due_date = isValid(parsed) ? parsed : addDays(new Date(), 30);
    }

    return safeData;
  }, [rawFormData]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [existingInstallments, setExistingInstallments] = useState([]);
  const [downPaymentError, setDownPaymentError] = useState('');
  const [costCenters, setCostCenters] = useState([]);
  const [isNewCostCenterModalOpen, setIsNewCostCenterModalOpen] = useState(false);
  const [clientListVersion, setClientListVersion] = useState(0);

  const title = type === 'credito' ? 'Crédito' : 'Débito';
  const entityLabel = type === 'credito' ? 'Cliente' : 'Fornecedor';
  const onBackPath = `/app/financeiro/${type}`;

  // Validação segura para valores numéricos
  const parsedTotalValue = useMemo(() => {
    try {
      return parseCurrency(formData.total_value || '0');
    } catch (error) {
      console.error('Erro ao parsear valor total:', error);
      return 0;
    }
  }, [formData.total_value]);

  const parsedDownPayment = useMemo(() => {
    try {
      return parseCurrency(formData.down_payment || '0');
    } catch (error) {
      console.error('Erro ao parsear entrada:', error);
      return 0;
    }
  }, [formData.down_payment]);

  // Buscar centros de custo
  const fetchCostCenters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('centro_custos')
        .select('nome')
        .order('nome', { ascending: true });

      if (error) throw error;

      const safeCostCenters = Array.isArray(data) ? data : [];
      setCostCenters(safeCostCenters.map(cc => ({ 
        value: cc?.nome || '', 
        label: cc?.nome || '' 
      })));

      // Set default cost center if not already set and data exists
      if (!formData.cost_center && safeCostCenters.length > 0) {
        const firstCostCenter = safeCostCenters[0]?.nome || 'ADMINISTRAÇÃO';
        handleUpdateRawFormData({ cost_center: firstCostCenter });
      }
    } catch (error) {
      console.error('Erro ao buscar centros de custo:', error);
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível carregar os centros de custo.', 
        variant: 'destructive' 
      });
      setCostCenters([]);
    }
  }, [toast, formData.cost_center]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  // Validar entrada
  useEffect(() => {
    if (parsedDownPayment > parsedTotalValue) {
      setDownPaymentError('O valor da entrada não pode ser maior que o valor total.');
    } else {
      setDownPaymentError('');
    }
  }, [parsedDownPayment, parsedTotalValue]);

  // ✅ Fetch dos dados para edição
  const fetchEntry = useCallback(async () => {
    if (!isEditing) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: entryData, error: entryError } = await supabase
        .from('credito_debito')
        .select('*')
        .eq('id', id)
        .single();

      if (entryError) throw entryError;

      // Buscar dados do cliente
      let clientData = null;
      if (entryData.pessoa_id) {
        const { data: clientDataResult, error: clientError } = await supabase
          .from('clientes')
          .select('id, nome, nome_fantasia, cnpj_cpf')
          .eq('id', entryData.pessoa_id)
          .single();

        if (!clientError) {
          clientData = clientDataResult;
        }
      }

      // Dados do banco com valores seguros
      const entryDataWithClient = {
        document_number: entryData?.document_number || '',
        issue_date: entryData?.issue_date || new Date().toISOString(),
        model: entryData?.model || 'Recibo',
        pessoa_id: entryData?.pessoa_id || null,
        cliente_fornecedor_name: clientData?.nome || entryData?.cliente_fornecedor_name || '',
        cliente_fornecedor_fantasy_name: clientData?.nome_fantasia || entryData?.cliente_fornecedor_fantasy_name || '',
        cnpj_cpf: clientData?.cnpj_cpf || entryData?.cnpj_cpf || '',
        description: entryData?.description || '',
        total_value: String(entryData?.total_value || '0').replace('.', ','),
        payment_method: entryData?.payment_method || 'pix',
        cost_center: entryData?.cost_center || 'ADMINISTRAÇÃO',
        notes: entryData?.notes || '',
        single_due_date: entryData?.issue_date || addDays(new Date(), 30).toISOString(),
      };

      // Lógica de merge com auto-save
      setRawFormData(prevFormData => {
        const isAutoSaveEmpty = !prevFormData || 
          Object.values(prevFormData).every(value => 
            value === '' || value === null || value === undefined || 
            (typeof value === 'string' && value.trim() === '') ||
            (Array.isArray(value) && value.length === 0)
          );
        
        if (isAutoSaveEmpty || !hasAutoSaveData) {
          console.log('Usando dados do banco (auto-save vazio)');
          return entryDataWithClient;
        } else {
          console.log('Fazendo merge entre auto-save e dados do banco');
          return {
            ...entryDataWithClient, // Dados base do banco
            ...prevFormData // Preserva alterações do auto-save (tem prioridade)
          };
        }
      });
    } catch (error) {
      console.error('Erro ao carregar lançamento:', error);
      toast({ 
        title: 'Erro ao carregar lançamento', 
        description: error.message, 
        variant: 'destructive' 
      });
      navigate(`/app/financeiro/${type}`);
    } finally {
      setLoading(false);
      hasFetchedInitialData.current = true;
    }
  }, [id, isEditing, navigate, toast, type, setRawFormData, hasAutoSaveData]);

  // Buscar dados apenas se estiver editando
  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        fetchEntry();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isEditing, fetchEntry]);

  // Resetar flag quando o ID mudar
  useEffect(() => {
    if (id) {
      hasFetchedInitialData.current = false;
    }
  }, [id]);

  // ✅ Função para atualizar o estado do auto-save
  const handleUpdateRawFormData = useCallback((updates) => {
    setRawFormData(prev => {
      const newRaw = { ...prev };
      for (const key in updates) {
        if (updates.hasOwnProperty(key)) {
          let value = updates[key];
          if (value instanceof Date) {
            newRaw[key] = value.toISOString();
          } else {
            newRaw[key] = value;
          }
        }
      }
      return newRaw;
    });
  }, [setRawFormData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    handleUpdateRawFormData({ [name]: value });
  };

  const handleSelectChange = (name, value) => {
    handleUpdateRawFormData({ [name]: value });
  };

  const handleDateChange = (date) => {
    handleUpdateRawFormData({ issue_date: date });
  };

  const handleClientSelectId = (clientId) => {
    handleUpdateRawFormData({ pessoa_id: clientId });
  };

  const handleClientNameChange = (name) => {
    handleUpdateRawFormData({ cliente_fornecedor_name: name });
  };

  const handleClientFantasyNameChange = (name) => {
    handleUpdateRawFormData({ cliente_fornecedor_fantasy_name: name });
  };

  const handleCnpjCpfChange = (cnpjCpfValue) => {
    handleUpdateRawFormData({ cnpj_cpf: cnpjCpfValue });
  };

  const handleInstallmentsChange = useCallback((installmentsData) => {
    handleUpdateRawFormData({ installments: installmentsData });
  }, [handleUpdateRawFormData]);

  const showInstallmentsGeneration = parsedTotalValue > 0 && parsedDownPayment >= 0 && parsedTotalValue > parsedDownPayment && !isEditing;

  useEffect(() => {
    if (!showInstallmentsGeneration) {
      handleInstallmentsChange([]);
    }
  }, [showInstallmentsGeneration, handleInstallmentsChange]);

  const handleNewClientSuccess = (newClient) => {
    setIsNewClientModalOpen(false);
    setClientListVersion(v => v + 1);
    handleUpdateRawFormData({
      pessoa_id: newClient?.id || null,
      cliente_fornecedor_name: newClient?.nome || '',
      cliente_fornecedor_fantasy_name: newClient?.nome_fantasia || '',
      cnpj_cpf: newClient?.cnpj_cpf || '',
    });
  };

  const handleNewCostCenterSuccess = (newCostCenter) => {
    setIsNewCostCenterModalOpen(false);
    fetchCostCenters();
    if (newCostCenter?.nome) {
      handleUpdateRawFormData({ cost_center: newCostCenter.nome });
    }
  };

  // ✅ Função para descartar alterações
  const handleDiscardChanges = () => {
    clearSavedData();
    navigate(onBackPath);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validação dos campos obrigatórios
    if (!formData.document_number?.trim() || 
        !formData.cliente_fornecedor_name?.trim() || 
        !unmask(formData.cnpj_cpf || '')?.trim() || 
        !formData.issue_date || 
        !formData.description?.trim() || 
        parsedTotalValue <= 0) {
      toast({ 
        title: 'Campos obrigatórios', 
        description: 'Preencha todos os campos obrigatórios (Nº Doc, Cliente/Fornecedor, CNPJ/CPF, Descrição, Valor Total).', 
        variant: 'destructive' 
      });
      return;
    }

    if (downPaymentError) {
      toast({
        title: 'Valor Inválido',
        description: downPaymentError,
        variant: 'destructive'
      });
      downPaymentInputRef.current?.element?.focus?.();
      return;
    }

    setSaving(true);

    // Payload seguro
    const basePayload = {
      document_number: formData.document_number || null,
      model: formData.model || 'Recibo',
      pessoa_id: formData.pessoa_id,
      cliente_fornecedor_name: formData.cliente_fornecedor_name || '',
      cliente_fornecedor_fantasy_name: formData.cliente_fornecedor_fantasy_name || null,
      cnpj_cpf: unmask(formData.cnpj_cpf || '') || null,
      description: formData.description || '',
      payment_method: formData.payment_method || 'pix',
      cost_center: formData.cost_center || 'ADMINISTRAÇÃO',
      notes: formData.notes || '',
      user_id: user?.id || null,
      issue_date: format(formData.issue_date, 'yyyy-MM-dd'),
      total_value: parsedTotalValue,
    };

    let result;
    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('credito_debito')
          .update(basePayload)
          .eq('id', id)
          .select()
          .single();
        result = { data, error };
      } else {
        const lancamentoId = uuidv4();
        let downPaymentPayload = null;
        let installmentsPayload = [];
        let totalInstallmentsCount = 0;

        if (parsedDownPayment === 0 && parsedTotalValue > 0) {
            installmentsPayload.push({
                amount: parsedTotalValue,
                date: format(formData.single_due_date, 'yyyy-MM-dd'),
                number: 1
            });
            totalInstallmentsCount = 1;
        } else if (parsedDownPayment > 0) {
            downPaymentPayload = {
                amount: parsedDownPayment,
                date: format(formData.issue_date, 'yyyy-MM-dd')
            };
            totalInstallmentsCount = 1;
            
            if (showInstallmentsGeneration) {
                installmentsPayload = (formData.installments || []).map(inst => ({
                    amount: inst.expected_amount,
                    date: format(inst.issue_date, 'yyyy-MM-dd'),
                    number: inst.installment_number
                }));
                totalInstallmentsCount += installmentsPayload.length;
            }
        }

        const rpcParams = {
            p_lancamento_id: lancamentoId,
            p_type: type,
            p_document_number: basePayload.document_number,
            p_model: basePayload.model,
            p_pessoa_id: basePayload.pessoa_id,
            p_cliente_fornecedor_name: basePayload.cliente_fornecedor_name,
            p_cliente_fornecedor_fantasy_name: basePayload.cliente_fornecedor_fantasy_name,
            p_cnpj_cpf: basePayload.cnpj_cpf,
            p_description: basePayload.description,
            p_payment_method: basePayload.payment_method,
            p_cost_center: basePayload.cost_center,
            p_notes: basePayload.notes,
            p_user_id: basePayload.user_id,
            p_total_installments: totalInstallmentsCount,
            p_down_payment: downPaymentPayload,
            p_installments: installmentsPayload
        };

        result = await supabase.rpc('create_financeiro_lancamento', rpcParams);
      }

      if (result.error || (result.data && !result.data.success)) {
        const errorMessage = result.error?.message || result.data?.message || 'Ocorreu um erro desconhecido.';
        throw new Error(errorMessage);
      }

      toast({ 
        title: `${title} ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`, 
        description: `${formData.description} foi salvo.` 
      });
      
      await logAction(`${isEditing ? 'update' : 'create'}_${type}_success`, { 
        lancamento_id: result.data?.lancamento_id || id, 
        entry_description: formData.description 
      });
      
      clearSavedData();
      hasFetchedInitialData.current = false;
      navigate(`/app/financeiro/${type}`);
      
    } catch (error) {
      console.error(`Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} ${title}:`, error);
      toast({ 
        title: `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} ${title}`, 
        description: error.message, 
        variant: 'destructive' 
      });
      await logAction(`${isEditing ? 'update' : 'create'}_${type}_failed`, { 
        error: error.message, 
        entry_description: formData.description 
      });
    } finally {
      setSaving(false);
    }
  };

  // Render loading
  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isEditing ? `Editar ${title}` : `Novo ${title}`} - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto p-4"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-emerald-300">
              <DollarSign className="w-8 h-8" />
              {isEditing ? `Editar ${title}` : `Novo ${title}`}
              {hasAutoSaveData && (
                <span className="text-sm text-yellow-400 ml-2">(Alterações não salvas)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <FinanceiroFormFields
                formData={formData}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                handleDateChange={handleDateChange}
                handleClientSelectId={handleClientSelectId}
                handleClientNameChange={handleClientNameChange}
                handleClientFantasyNameChange={handleClientFantasyNameChange}
                handleCnpjCpfChange={handleCnpjCpfChange}
                costCenters={costCenters}
                entityLabel={entityLabel}
                clientListVersion={clientListVersion}
                isNewClientModalOpen={isNewClientModalOpen}
                setIsNewClientModalOpen={setIsNewClientModalOpen}
                isNewCostCenterModalOpen={isNewCostCenterModalOpen}
                setIsNewCostCenterModalOpen={setIsNewCostCenterModalOpen}
                handleNewClientSuccess={handleNewClientSuccess}
                handleNewCostCenterSuccess={handleNewCostCenterSuccess}
                isEditing={isEditing}
              />

              {!isEditing && (
                <InstallmentDetails
                  formData={formData}
                  handleInputChange={handleInputChange}
                  downPaymentInputRef={downPaymentInputRef}
                  downPaymentError={downPaymentError}
                  singleDueDate={formData.single_due_date}
                  setSingleDueDate={(date) => handleUpdateRawFormData({ single_due_date: date })}
                  parsedTotalValue={parsedTotalValue}
                  parsedDownPayment={parsedDownPayment}
                  showInstallments={showInstallmentsGeneration}
                  handleInstallmentsChange={handleInstallmentsChange}
                  existingInstallments={existingInstallments}
                  isEditing={isEditing}
                />
              )}

              <div className="flex justify-between items-center pt-6">
                <Button 
                  type="button" 
                  onClick={() => navigate(onBackPath)} 
                  variant="outline" 
                  className="rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
                
                <div className="flex gap-2">
                  {hasAutoSaveData && (
                    <Button 
                      type="button"
                      onClick={handleDiscardChanges}
                      variant="outline"
                      className="rounded-xl text-yellow-400 border-yellow-400"
                    >
                      Descartar Alterações
                    </Button>
                  )}
                  
                  <Button 
                    type="submit" 
                    disabled={saving} 
                    className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  >
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default FinanceiroForm;