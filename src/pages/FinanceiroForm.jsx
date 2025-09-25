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
import { format, addDays, parseISO, isValid } from 'date-fns'; // Import parseISO and isValid
import { v4 as uuidv4 } from 'uuid';
import { FinanceiroFormFields } from '@/components/financeiro/FinanceiroFormFields';
import { InstallmentDetails } from '@/components/financeiro/InstallmentDetails';
import { FinanceiroFormActions } from '@/components/financeiro/FinanceiroFormActions';
import { useAutoSave } from '@/hooks/useAutoSave'; // Import useAutoSave

const FinanceiroForm = ({ type }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id);
  const downPaymentInputRef = useRef(null);

  // Chave única para o localStorage, dependendo se é crédito ou débito
  const localStorageKey = `financeiroForm_isNewClientModalOpen_${type}`;

  // Estado do modal de novo cliente/fornecedor, inicializado de forma lazy do localStorage
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return localStorage.getItem(localStorageKey) === 'true';
  });

  // Flag para indicar que o componente foi hidratado com o estado do localStorage
  const [hydrated, setHydrated] = useState(false);

  // Efeito para salvar o estado do modal no localStorage sempre que ele mudar
  useEffect(() => {
    localStorage.setItem(localStorageKey, isNewClientModalOpen ? 'true' : 'false');
  }, [localStorageKey, isNewClientModalOpen]);

  // Efeito para definir hydrated como true após a primeira renderização no cliente
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Initial state for useAutoSave
  const getInitialFormData = useCallback((currentType) => ({
    document_number: '',
    issue_date: new Date().toISOString(), // Store as ISO string
    model: 'Recibo',
    pessoa_id: null,
    cliente_fornecedor_name: '',
    cliente_fornecedor_fantasy_name: '',
    cnpj_cpf: '',
    description: '',
    total_value: '',
    payment_method: 'pix',
    cost_center: 'ADMINISTRAÇÃO', // Default, will be updated by fetched data
    notes: '',
    down_payment: '0,00',
    installments_number: 0,
    installments: [],
    single_due_date: addDays(new Date(), 30).toISOString(), // Store as ISO string
  }), []);

  const autoSaveKey = id ? `financeiroForm_edit_${id}` : `financeiroForm_new_${type}`;
  const [rawFormData, setRawFormData, clearSavedData, savedData] = useAutoSave(
    autoSaveKey,
    getInitialFormData(type),
    !isEditing // Only load from auto-save if not in edit mode
  );

  // Process rawFormData to get Date objects for component use
  const formData = useMemo(() => {
    const processed = { ...rawFormData };
    if (typeof processed.issue_date === 'string') {
      const parsed = parseISO(processed.issue_date);
      processed.issue_date = isValid(parsed) ? parsed : new Date();
    }
    if (typeof processed.single_due_date === 'string') {
      const parsed = parseISO(processed.single_due_date);
      processed.single_due_date = isValid(parsed) ? parsed : addDays(new Date(), 30);
    }
    return processed;
  }, [rawFormData]);

  // Update rawFormData (which triggers auto-save)
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

  const [loading, setLoading] = useState(true); // Keep local loading state for initial fetches
  const [saving, setSaving] = useState(false);
  const [existingInstallments, setExistingInstallments] = useState([]);
  const [downPaymentError, setDownPaymentError] = useState('');
  const [costCenters, setCostCenters] = useState([]);
  const [isNewCostCenterModalOpen, setIsNewCostCenterModalOpen] = useState(false);
  const [clientListVersion, setClientListVersion] = useState(0);

  const title = type === 'credito' ? 'Crédito' : 'Débito';
  const entityLabel = type === 'credito' ? 'Cliente' : 'Fornecedor';
  const onBackPath = `/app/financeiro/${type}`;

  const parsedTotalValue = parseCurrency(formData.total_value);
  const parsedDownPayment = parseCurrency(formData.down_payment);

  const fetchCostCenters = useCallback(async () => {
    const { data, error } = await supabase
      .from('centro_custos')
      .select('nome')
      .order('nome', { ascending: true });
    if (error) {
      console.error('Erro ao buscar centros de custo:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar os centros de custo.', variant: 'destructive' });
      setCostCenters([]);
    } else {
      setCostCenters(data.map(cc => ({ value: cc.nome, label: cc.nome })));
      // Set default cost center if not already set and data exists
      if (!formData.cost_center && data.length > 0) {
        handleUpdateRawFormData({ cost_center: data[0].nome });
      }
    }
  }, [toast, formData.cost_center, handleUpdateRawFormData]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  useEffect(() => {
    if (parsedDownPayment > parsedTotalValue) {
      setDownPaymentError('O valor da entrada não pode ser maior que o valor total.');
    } else {
      setDownPaymentError('');
    }
  }, [parsedDownPayment, parsedTotalValue]);

  const fetchEntry = useCallback(async () => {
    if (!isEditing) {
      setLoading(false);
      return;
    }
    setLoading(true);
    toast({
        title: 'Função em Desenvolvimento',
        description: 'A edição de lançamentos parcelados está sendo ajustada. Por favor, exclua o lançamento e crie-o novamente.',
        variant: 'destructive',
        duration: 10000,
    });
    navigate(`/app/financeiro/${type}`);
    setLoading(false);
  }, [id, isEditing, navigate, toast, type]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

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

  const showInstallments = parsedTotalValue > 0 && parsedDownPayment >= 0 && parsedTotalValue > parsedDownPayment;

  useEffect(() => {
    if (!showInstallments) {
      handleInstallmentsChange([]);
    }
  }, [showInstallments, handleInstallmentsChange]);

  const handleNewClientSuccess = (newClient) => {
    setIsNewClientModalOpen(false);
    setClientListVersion(v => v + 1);
    handleUpdateRawFormData({
      pessoa_id: newClient.id,
      cliente_fornecedor_name: newClient.nome,
      cliente_fornecedor_fantasy_name: newClient.nome_fantasia,
      cnpj_cpf: newClient.cnpj_cpf,
    });
  };

  const handleNewCostCenterSuccess = (newCostCenter) => {
    setIsNewCostCenterModalOpen(false);
    fetchCostCenters();
    handleUpdateRawFormData({ cost_center: newCostCenter.nome });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.document_number.trim() || !formData.cliente_fornecedor_name.trim() || !unmask(formData.cnpj_cpf).trim() || !formData.issue_date || !formData.description.trim() || parsedTotalValue <= 0) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios (Nº Doc, Cliente/Fornecedor, CNPJ/CPF, Descrição, Valor Total).', variant: 'destructive' });
      return;
    }

    if (downPaymentError) {
      toast({
        title: 'Valor Inválido',
        description: downPaymentError,
        variant: 'destructive'
      });
      downPaymentInputRef.current?.element.focus();
      return;
    }

    setSaving(true);

    if (isEditing) {
        toast({ title: 'Função em desenvolvimento', description: 'A edição de lançamentos parcelados está sendo ajustada.', variant: 'destructive' });
        setSaving(false);
        return;
    }

    const lancamentoId = uuidv4();
    
    let downPaymentPayload = null;
    let installmentsPayload = [];
    let totalInstallmentsCount = 0;

    if (parsedDownPayment === 0 && parsedTotalValue > 0) {
        installmentsPayload.push({
            amount: parsedTotalValue,
            date: format(formData.single_due_date, 'yyyy-MM-dd'), // Use formData.single_due_date
            number: 1
        });
        totalInstallmentsCount = 1;
    } else if (parsedDownPayment > 0) {
        downPaymentPayload = {
            amount: parsedDownPayment,
            date: format(formData.issue_date, 'yyyy-MM-dd')
        };
        totalInstallmentsCount = 1;
        
        if (showInstallments) {
            installmentsPayload = formData.installments.map(inst => ({
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
        p_document_number: formData.document_number || null,
        p_model: formData.model,
        p_pessoa_id: formData.pessoa_id,
        p_cliente_fornecedor_name: formData.cliente_fornecedor_name,
        p_cliente_fornecedor_fantasy_name: formData.cliente_fornecedor_fantasy_name || null,
        p_cnpj_cpf: unmask(formData.cnpj_cpf) || null,
        p_description: formData.description,
        p_payment_method: formData.payment_method,
        p_cost_center: formData.cost_center,
        p_notes: formData.notes,
        p_user_id: user.id,
        p_total_installments: totalInstallmentsCount,
        p_down_payment: downPaymentPayload,
        p_installments: installmentsPayload
    };

    const { data, error } = await supabase.rpc('create_financeiro_lancamento', rpcParams);

    if (error || (data && !data.success)) {
      const errorMessage = error?.message || data?.message || 'Ocorreu um erro desconhecido.';
      toast({ title: `Erro ao cadastrar ${title}`, description: errorMessage, variant: 'destructive' });
      await logAction(`create_${type}_failed`, { error: errorMessage, entry_description: formData.description });
    } else {
      toast({ title: `${title} cadastrado com sucesso!`, description: `${formData.description} foi salvo com todas as parcelas.` });
      await logAction(`create_${type}_success`, { lancamento_id: data.lancamento_id, entry_description: formData.description });
      clearSavedData(); // Clear auto-saved data on successful submission
      navigate(`/app/financeiro/${type}`);
    }
    setSaving(false);
  };

  // Renderiza um loader ou nada se não estiver hidratado
  if (!hydrated || loading) {
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

              <InstallmentDetails
                formData={formData}
                handleInputChange={handleInputChange}
                downPaymentInputRef={downPaymentInputRef}
                downPaymentError={downPaymentError}
                singleDueDate={formData.single_due_date} // Use formData.single_due_date
                setSingleDueDate={(date) => handleUpdateRawFormData({ single_due_date: date })} // Update via handleUpdateRawFormData
                parsedTotalValue={parsedTotalValue}
                parsedDownPayment={parsedDownPayment}
                showInstallments={showInstallments}
                handleInstallmentsChange={handleInstallmentsChange}
                existingInstallments={existingInstallments}
                isEditing={isEditing}
              />

              <FinanceiroFormActions 
                onBackPath={onBackPath} 
                isSaving={saving} 
                isEditing={isEditing} 
              />
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default FinanceiroForm;