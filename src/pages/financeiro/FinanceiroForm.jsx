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
import { unmask, parseCurrency, formatNumber } from '@/lib/utils';
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
  const documentNumberRef = useRef(null);

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
    description: '',
    document_value: '',
    desconto_value: '',
    interest_value: '',
    total_value: '',
    payment_method: 'pix',
    cost_center: '',
    notes: '',
    down_payment: '',
    installments_number: 0,
    installments: [],
    single_due_date: addDays(new Date(), 30).toISOString(),
  }), []);

  const initialFormData = useMemo(() => getInitialFormData(), [getInitialFormData]);

  const autoSaveKey = id ? `financeiroForm_edit_${id}` : `financeiroForm_new_${type}`;

  const [rawFormData, setRawFormData, clearSavedData] = useAutoSave(
    autoSaveKey,
    initialFormData,
    true
  );

  // Verificar se há dados no auto-save sempre que o componente monta ou quando rawFormData muda
  useEffect(() => {
    const checkAutoSave = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(autoSaveKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Verificar se há dados significativos (não apenas valores padrão/vazios)
            const hasSignificantData = parsed && (
              parsed.document_number?.trim() ||
              parsed.cliente_fornecedor_name?.trim() ||
              parsed.description?.trim() ||
              parsed.total_value?.trim() ||
              (parsed.installments && parsed.installments.length > 0)
            );
            setHasAutoSaveData(hasSignificantData);
          } catch (e) {
            setHasAutoSaveData(false);
          }
        } else {
          setHasAutoSaveData(false);
        }
      }
    };

    checkAutoSave();
  }, [autoSaveKey, rawFormData]);

  // Process rawFormData para obter Date objects
  const formData = useMemo(() => {
    const processed = { ...rawFormData };

    // Garantir que todas as propriedades existam
    const safeData = {
      lancamento_id: processed?.lancamento_id || null,
      document_number: processed?.document_number || '',
      issue_date: processed?.issue_date || new Date().toISOString(),
      model: processed?.model || 'Recibo',
      pessoa_id: processed?.pessoa_id || null,
      cliente_fornecedor_name: processed?.cliente_fornecedor_name || '',
      cliente_fornecedor_fantasy_name: processed?.cliente_fornecedor_fantasy_name || '',
      cnpj_cpf: processed?.cnpj_cpf || '',
      description: processed?.description || '',
      document_value: processed?.document_value ?? '',
      desconto_value: processed?.desconto_value ?? '',
      interest_value: processed?.interest_value ?? '',
      total_value: processed?.total_value ?? '',
      payment_method: processed?.payment_method || 'pix',
      cost_center: processed?.cost_center || '',
      notes: processed?.notes || '',
      down_payment: processed?.down_payment ?? '',
      installments_number: processed?.installments_number || 0,
      installments: processed?.installments || [],
      single_due_date: processed?.single_due_date || addDays(new Date(), 30).toISOString(),
    };

    // Processar datas
    if (typeof safeData.issue_date === 'string') {
      if (!safeData.issue_date || safeData.issue_date === '') {
        safeData.issue_date = new Date();
      } else {
        const parsed = parseISO(safeData.issue_date);
        safeData.issue_date = isValid(parsed) ? parsed : new Date();
      }
    } else if (!safeData.issue_date || !isValid(safeData.issue_date)) {
      safeData.issue_date = new Date();
    }

    if (typeof safeData.single_due_date === 'string') {
      if (!safeData.single_due_date || safeData.single_due_date === '') {
        safeData.single_due_date = addDays(new Date(), 30);
      } else {
        const parsed = parseISO(safeData.single_due_date);
        safeData.single_due_date = isValid(parsed) ? parsed : addDays(new Date(), 30);
      }
    } else if (!safeData.single_due_date || !isValid(safeData.single_due_date)) {
      safeData.single_due_date = addDays(new Date(), 30);
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
  const [costCenterListVersion, setCostCenterListVersion] = useState(0);

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

      // Não definir centro de custo padrão - deixar o usuário escolher
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

  // ✅ Foco automático no documento ao abrir
  useEffect(() => {
    if (!loading && documentNumberRef.current) {
      setTimeout(() => {
        documentNumberRef.current?.focus();
      }, 100);
    }
  }, [loading]);

  // ✅ Fetch dos dados para edição
  const fetchEntry = useCallback(async () => {
    if (!isEditing || hasFetchedInitialData.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: entryData, error: entryError } = await supabase
        .from('credito_debito')
        .select(`
          id, lancamento_id, type, document_number, model, 
          pessoa_id, cliente_fornecedor_name, cliente_fornecedor_fantasy_name, 
          cnpj_cpf, description, payment_method, cost_center, 
          notes, user_id, issue_date, total_value,
          installment_number, total_installments, installment_value, 
          paid_amount, amount_balance, status
        `)
        .eq('id', id)
        .single();

      if (entryError) throw entryError;

      // Buscar dados do cliente
      let clientData = null;
      if (entryData.pessoa_id) {
        const { data: clientDataResult, error: clientError } = await supabase
          .from('clientes')
          .select('id, razao_social, nome_fantasia, cnpj_cpf')
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
        cliente_fornecedor_name: clientData?.razao_social || entryData?.cliente_fornecedor_name || '',
        cliente_fornecedor_fantasy_name: clientData?.nome_fantasia || entryData?.cliente_fornecedor_fantasy_name || '',
        cnpj_cpf: clientData?.cnpj_cpf || entryData?.cnpj_cpf || '',
        description: entryData?.description || '',
        // total_value armazena o BRUTO no banco RJR
        document_value: formatNumber(entryData?.total_value || 0),
        // Desconto (coluna discount)
        desconto_value: formatNumber(entryData?.discount || 0),
        // Juros (coluna interest)
        interest_value: formatNumber(entryData?.interest || 0),
        // total_value = document_value - discount + interest (valor efetivo)
        total_value: formatNumber(entryData?.total_value || 0),
        payment_method: entryData?.payment_method || 'pix',
        cost_center: entryData?.cost_center || '',
        notes: entryData?.notes || '',
        single_due_date: entryData?.issue_date || addDays(new Date(), 30).toISOString(),
        lancamento_id: entryData?.lancamento_id || null,
        down_payment: '',
        installments_number: 0,
        installments: [],
      };

      // Se houver lancamento_id, buscar todas as parcelas
      if (entryData.lancamento_id) {
        const { data: installmentsData, error: instError } = await supabase
          .from('credito_debito')
          .select('id, installment_number, issue_date, installment_value, total_value, paid_amount, status')
          .eq('lancamento_id', entryData.lancamento_id)
          .order('installment_number', { ascending: true });

        if (!instError && installmentsData.length > 0) {
          // Identificar entrada (installment_number = 0)
          const downPaymentEntry = installmentsData.find(i => i.installment_number === 0);
          if (downPaymentEntry) {
            entryDataWithClient.down_payment = formatNumber(downPaymentEntry.installment_value || downPaymentEntry.total_value || 0);
          }

          // Identificar parcelas regulares (installment_number > 0)
          const regularInstallments = installmentsData.filter(i => i.installment_number > 0);
          if (regularInstallments.length > 0) {
            entryDataWithClient.installments_number = regularInstallments.length;
            entryDataWithClient.installments = regularInstallments.map(i => ({
              id: i.id, // Importante para updates futuros
              installment_number: i.installment_number,
              issue_date: i.issue_date,
              expected_amount: i.installment_value || i.total_value,
              paid_amount: i.paid_amount,
              status: i.status
            }));

            // ✅ CORREÇÃO: Setar estado local para o InstallmentTable
            setExistingInstallments(entryDataWithClient.installments);

            // Se não houver entrada, e houver mais de uma parcela, o single_due_date é da primeira parcela > 0
            if (!downPaymentEntry && regularInstallments.length === 1) {
              entryDataWithClient.single_due_date = regularInstallments[0].issue_date;
            }
          }
        }
      }

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

          // Se estamos editando, e o auto-save não tem parcelas mas o banco tem, preservar do banco
          const finalInstallments = (prevFormData.installments && prevFormData.installments.length > 0)
            ? prevFormData.installments
            : entryDataWithClient.installments;

          const finalInstallmentsNumber = prevFormData.installments_number !== undefined
            ? prevFormData.installments_number
            : entryDataWithClient.installments_number;

          const finalDownPayment = (prevFormData.down_payment && prevFormData.down_payment !== '0,00')
            ? prevFormData.down_payment
            : entryDataWithClient.down_payment;

          return {
            ...entryDataWithClient, // Dados base do banco (prioridade para campos de identificação)
            ...prevFormData,        // Alterações do auto-save
            // Garantir que campos críticos do cliente e documento não fiquem vazios se o auto-save falhar
            cliente_fornecedor_name: prevFormData.cliente_fornecedor_name || entryDataWithClient.cliente_fornecedor_name,
            cnpj_cpf: prevFormData.cnpj_cpf || entryDataWithClient.cnpj_cpf,
            document_number: prevFormData.document_number || entryDataWithClient.document_number,
            pessoa_id: prevFormData.pessoa_id || entryDataWithClient.pessoa_id,
            installments: finalInstallments,
            installments_number: finalInstallmentsNumber,
            down_payment: finalDownPayment
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
  }, [id, isEditing, navigate, toast, type, setRawFormData]); // ✅ Removido hasAutoSaveData para evitar loop infinito

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

  // Recalcular total_value quando document_value ou desconto_value mudam
  const parseCurrencyStr = (str) => {
    if (!str) return 0;
    return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
  };

  const handleDocumentValueChange = useCallback((value) => {
    const docVal = parseCurrencyStr(value);
    let descVal = parseCurrencyStr(rawFormData?.desconto_value);
    let finalDescontoValue = rawFormData?.desconto_value;

    // Se o novo valor do documento for menor que o desconto atual, ajusta o desconto
    if (docVal < descVal) {
      descVal = docVal;
      finalDescontoValue = formatNumber(docVal);
    }

    const interestVal = parseCurrencyStr(rawFormData?.interest_value);
    const totalVal = Math.max(0, docVal - descVal + interestVal);

    const updates = {
      document_value: value,
      desconto_value: finalDescontoValue,
      total_value: formatNumber(totalVal),
    };

    // Se surgiu saldo e parcelas estão em 0, sugerir 1 parcela
    const downVal = parseCurrencyStr(rawFormData?.down_payment);
    if (totalVal > downVal + 0.01 && (rawFormData?.installments_number || 0) === 0) {
      updates.installments_number = 1;
    }

    handleUpdateRawFormData(updates);
  }, [rawFormData?.desconto_value, rawFormData?.interest_value, rawFormData?.down_payment, rawFormData?.installments_number, handleUpdateRawFormData]);

  const handleDescontoChange = useCallback((value) => {
    const docVal = parseCurrencyStr(rawFormData?.document_value);
    const descVal = parseCurrencyStr(value);
    const interestVal = parseCurrencyStr(rawFormData?.interest_value);
    const totalVal = Math.max(0, docVal - descVal + interestVal);

    const updates = {
      desconto_value: value,
      total_value: formatNumber(totalVal),
    };

    const downVal = parseCurrencyStr(rawFormData?.down_payment);
    if (totalVal > downVal + 0.01 && (rawFormData?.installments_number || 0) === 0) {
      updates.installments_number = 1;
    }

    handleUpdateRawFormData(updates);
  }, [rawFormData?.document_value, rawFormData?.interest_value, rawFormData?.down_payment, rawFormData?.installments_number, handleUpdateRawFormData]);

  const handleInterestChange = useCallback((value) => {
    const docVal = parseCurrencyStr(rawFormData?.document_value);
    const descVal = parseCurrencyStr(rawFormData?.desconto_value);
    const interestVal = parseCurrencyStr(value);
    const totalVal = Math.max(0, docVal - descVal + interestVal);

    const updates = {
      interest_value: value,
      total_value: formatNumber(totalVal),
    };

    const downVal = parseCurrencyStr(rawFormData?.down_payment);
    if (totalVal > downVal + 0.01 && (rawFormData?.installments_number || 0) === 0) {
      updates.installments_number = 1;
    }

    handleUpdateRawFormData(updates);
  }, [rawFormData?.document_value, rawFormData?.desconto_value, rawFormData?.down_payment, rawFormData?.installments_number, handleUpdateRawFormData]);

  const showInstallmentsGeneration = parsedTotalValue > 0 && parsedDownPayment >= 0 && parsedTotalValue > parsedDownPayment && !isEditing;

  // ✅ CORREÇÃO: Limpar parcelas automaticamente se o saldo for zero (quitação à vista)
  // Independente de ser edição ou criação, se o saldo for zero, não deve haver parcelas.
  useEffect(() => {
    const remainingBalance = parsedTotalValue - parsedDownPayment;

    // Se não for para mostrar a geração de parcelas (criação) OU se o saldo for zero (edição/criação)
    if ((!isEditing && !showInstallmentsGeneration) || (Math.abs(remainingBalance) < 0.01 && parsedTotalValue > 0)) {
      if (formData.installments?.length > 0) {
        handleInstallmentsChange([]);
      }
    }
  }, [showInstallmentsGeneration, handleInstallmentsChange, isEditing, parsedTotalValue, parsedDownPayment, formData.installments?.length]);

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
    setCostCenterListVersion(v => v + 1);
    fetchCostCenters();
    if (newCostCenter?.nome) {
      handleUpdateRawFormData({ cost_center: newCostCenter.nome });
    }
  };

  // ✅ Função para descartar alterações
  const handleDiscardChanges = () => {
    // Usar clearSavedData do hook para garantir limpeza completa
    clearSavedData();

    // Resetar estado manualmente também
    setHasAutoSaveData(false);

    // Resetar para dados iniciais
    const resetData = getInitialFormData();
    setRawFormData(resetData);

    // Navegar de volta
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

    // ✅ NOVA VALIDAÇÃO: Bloquear se houver erro de saldo/parcelas
    const remainingBalance = parsedTotalValue - parsedDownPayment;
    const installmentsSum = (formData.installments || []).reduce((acc, curr) => acc + Number(curr.expected_amount || 0), 0);

    if (remainingBalance > 0 && Math.abs(remainingBalance - installmentsSum) > 0.01) {
      toast({
        title: 'Soma das parcelas incorreta',
        description: `A soma das parcelas (R$ ${installmentsSum.toFixed(2)}) não corresponde ao saldo (R$ ${remainingBalance.toFixed(2)}).`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);

    const valorBruto = parseCurrencyStr(formData.document_value);
    const valorDesconto = parseCurrencyStr(formData.desconto_value);
    const valorJuros = parseCurrencyStr(formData.interest_value);

    // Payload seguro - Alinhado com as colunas REAIS da tabela credito_debito
    const basePayload = {
      document_number: formData.document_number || null,
      model: formData.model || 'Recibo',
      pessoa_id: formData.pessoa_id,
      cliente_fornecedor_name: formData.cliente_fornecedor_name || '',
      cliente_fornecedor_fantasy_name: formData.cliente_fornecedor_fantasy_name || null,
      cnpj_cpf: unmask(formData.cnpj_cpf || '') || null,
      description: formData.description || '',
      payment_method: formData.payment_method || 'pix',
      cost_center: formData.cost_center || null,
      notes: formData.notes || '',
      user_id: user?.id || null,
      issue_date: format(formData.issue_date, 'yyyy-MM-dd'),
      discount: valorDesconto,
      interest: valorJuros,
      total_value: valorBruto, // No banco RJR, total_value armazena o BRUTO
    };

    let result;
    try {
      if (isEditing) {
        // Se houver lancamento_id, atualizar todas as parcelas do grupo com os dados básicos
        console.log('🔧 [EDIT] isEditing=true, id=', id, 'lancamento_id=', formData.lancamento_id, 'installments=', formData.installments?.length);
        if (formData.lancamento_id) {
          // 1. Atualizar campos básicos garantidos em TODAS as linhas do lancamento
          const { error: updateAllError } = await supabase
            .from('credito_debito')
            .update({
              document_number: basePayload.document_number,
              model: basePayload.model,
              pessoa_id: basePayload.pessoa_id,
              cliente_fornecedor_name: basePayload.cliente_fornecedor_name,
              cliente_fornecedor_fantasy_name: basePayload.cliente_fornecedor_fantasy_name,
              cnpj_cpf: basePayload.cnpj_cpf,
              description: basePayload.description,
              payment_method: basePayload.payment_method,
              cost_center: basePayload.cost_center,
              notes: basePayload.notes,
              total_value: valorBruto,
              issue_date: basePayload.issue_date,
            })
            .eq('lancamento_id', formData.lancamento_id);

          if (updateAllError) throw updateAllError;

          // Tentativa silenciosa de atualizar campos novos (podem não existir no banco do cliente)
          try {
            await supabase.from('credito_debito').update({ discount: valorDesconto }).eq('lancamento_id', formData.lancamento_id);
            await supabase.from('credito_debito').update({ interest: valorJuros }).eq('lancamento_id', formData.lancamento_id);
          } catch (e) {
            console.warn('Campos opcionais não atualizados');
          }

          // 2. Atualizar a ENTRADA (installment_number = 0) com o novo installment_value
          if (parsedDownPayment > 0) {
            const { error: dpErr } = await supabase
              .from('credito_debito')
              .update({
                installment_value: parsedDownPayment,
                total_value: valorBruto,
                paid_amount: parsedDownPayment,
                amount_balance: 0,
              })
              .eq('lancamento_id', formData.lancamento_id)
              .eq('installment_number', 0);
            if (dpErr) throw dpErr;
          }

          // 3. Buscar parcelas atuais do banco para comparar
          const { data: dbInstallments } = await supabase
            .from('credito_debito')
            .select('id, installment_number')
            .eq('lancamento_id', formData.lancamento_id)
            .gt('installment_number', 0)
            .order('installment_number', { ascending: true });

          const dbIds = (dbInstallments || []).map(i => i.id);
          const formIds = (formData.installments || []).map(i => i.id).filter(Boolean);

          // 4. Excluir parcelas que foram removidas da UI (Usando RPC segura para evitar gatilho de bloqueio)
          const toDelete = dbIds.filter(dbId => !formIds.includes(dbId));
          if (toDelete.length > 0) {
            const { data: deleteData, error: deleteError } = await supabase.rpc('delete_installments_safe', {
              p_ids: toDelete
            });
            if (deleteError || (deleteData && !deleteData.success)) {
              throw new Error(deleteError?.message || deleteData?.message || 'Erro ao remover parcelas antigas.');
            }
          }

          // 5. Atualizar ou criar parcelas
          for (const inst of (formData.installments || [])) {
            const instDate = format(
              typeof inst.issue_date === 'string' ? parseISO(inst.issue_date) : inst.issue_date,
              'yyyy-MM-dd'
            );
            if (inst.id) {
              // Atualizar existente
              await supabase
                .from('credito_debito')
                .update({
                  issue_date: instDate,
                  installment_value: inst.expected_amount,
                  total_value: valorBruto,
                  amount_balance: inst.expected_amount - (inst.paid_amount || 0),
                })
                .eq('id', inst.id);
            } else {
              // Criar nova parcela
              await supabase.from('credito_debito').insert({
                lancamento_id: formData.lancamento_id,
                type,
                document_number: basePayload.document_number,
                model: basePayload.model,
                pessoa_id: basePayload.pessoa_id,
                cliente_fornecedor_name: basePayload.cliente_fornecedor_name,
                cliente_fornecedor_fantasy_name: basePayload.cliente_fornecedor_fantasy_name,
                cnpj_cpf: basePayload.cnpj_cpf,
                description: basePayload.description,
                issue_date: instDate,
                total_value: valorBruto,
                installment_value: inst.expected_amount,
                payment_method: basePayload.payment_method,
                cost_center: basePayload.cost_center,
                notes: basePayload.notes,
                user_id: basePayload.user_id,
                installment_number: inst.installment_number,
                total_installments: (parsedDownPayment > 0 ? 1 : 0) + formData.installments.length,
                paid_amount: 0,
                amount_balance: inst.expected_amount,
                status: 'pending',
              });
            }
          }

          // Sucesso
          result = { data: { success: true, lancamento_id: formData.lancamento_id }, error: null };
        } else {
          // Fallback para edição individual se não houver lancamento_id
          const cleanPayload = { ...basePayload };
          delete cleanPayload.discount;
          delete cleanPayload.interest;

          const { data, error } = await supabase
            .from('credito_debito')
            .update(cleanPayload)
            .eq('id', id)
            .select(`
              id, lancamento_id, document_number, total_value, issue_date, 
              installment_number, total_installments, installment_value, 
              paid_amount, amount_balance, status
            `)
            .single();

          if (!error && data) {
            // Tenta atualizar colunas novas se existirem
            await supabase.from('credito_debito').update({ discount: valorDesconto, interest: valorJuros }).eq('id', id);
          }

          result = { data, error };
        }
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
              date: format(typeof inst.issue_date === 'string' ? parseISO(inst.issue_date) : inst.issue_date, 'yyyy-MM-dd'),
              number: inst.installment_number
            }));
            totalInstallmentsCount += installmentsPayload.length;
          }
        }

        // ✅ GARANTIR SOMA CORRETA: O valor total do documento deve ser a soma de entrada + parcelas
        const calculoValorDocumento = parsedDownPayment + installmentsPayload.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

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
          p_total_value: valorBruto, // Bruto para ser salvo como document_value e total_value base
          p_discount: valorDesconto,
          p_interest: valorJuros,
          p_down_payment: downPaymentPayload,
          p_installments: installmentsPayload
        };

        console.log('🚀 [DEBUG] Valores calculados para salvamento:', {
          informado: parsedTotalValue,
          somaReal: calculoValorDocumento,
          entrada: parsedDownPayment,
          parcelas: installmentsPayload.length
        });

        try {
          console.log('🚀 [RPC] Tentando salvar com assinatura de 19 parâmetros...');
          result = await supabase.rpc('create_financeiro_lancamento', rpcParams);
        } catch (e) {
          console.error('❌ Erro na RPC:', e.message);
          result = { error: e };
        }

        // ✅ SINCRONIZAÇÃO FORÇADA PÓS-RPC (Garantir o Bruto no banco se as colunas existirem)
        if (!result.error && result.data?.success) {
          const finalLancamentoId = result.data.lancamento_id || lancamentoId;

          try {
            // Tenta atualizar colunas novas individualmente para não quebrar o fluxo se uma faltar
            await supabase.from('credito_debito').update({ total_value: valorBruto }).eq('lancamento_id', finalLancamentoId);
            await supabase.from('credito_debito').update({ discount: valorDesconto }).eq('lancamento_id', finalLancamentoId);
            await supabase.from('credito_debito').update({ interest: valorJuros }).eq('lancamento_id', finalLancamentoId);
          } catch (syncErr) {
            console.warn('⚠️ Sincronização parcial de colunas:', syncErr.message);
          }
        }
      }

      // CORREÇÃO: Verificar se houve erro ou se a atualização não retornou dados
      if (result.error) {
        throw new Error(result.error.message || 'Ocorreu um erro desconhecido.');
      }

      // Para atualização, verificar se retornou dados (update retorna os dados atualizados)
      if (isEditing && !result.data) {
        throw new Error('Erro ao atualizar: nenhum dado retornado.');
      }

      // Para criação, verificar se a RPC retornou sucesso
      if (!isEditing && result.data && !result.data.success) {
        throw new Error(result.data?.message || 'Ocorreu um erro desconhecido.');
      }

      toast({
        title: `${title} ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`,
        description: `Documento ${formData.document_number || '(Sem número)'} foi salvo.`
      });

      await logAction(`${isEditing ? 'update' : 'create'}_${type}_success`, {
        lancamento_id: result.data?.lancamento_id || id,
        entry_document: formData.document_number
      });

      clearSavedData();
      hasFetchedInitialData.current = false;

      // REGRA: Apenas para Débito, modelo Recibo, em criação e se estiver QUITADO (entrada = total)
      if (!isEditing && type === 'debito' && formData.model === 'Recibo' && Math.abs(parsedDownPayment - parsedTotalValue) < 0.01) {
        const LancarId = result.data?.lancamento_id || id;

        const { dismiss } = toast({
          title: "Lançamento realizado com sucesso!",
          description: "Deseja gerar e abrir o recibo para este lançamento?",
          duration: Infinity,
          action: (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  dismiss();
                  navigate(`/app/financeiro/${type}`);
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Não
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={async () => {
                  dismiss(); // Fecha o toast imediatamente ao clicar
                  try {
                    // 1. Buscar dados detalhados da pessoa
                    const { data: person } = await supabase
                      .from('clientes')
                      .select('*')
                      .eq('id', formData.pessoa_id)
                      .single();

                    // 2. Gerar número do recibo
                    const { data: numero } = await supabase.rpc('generate_recibo_avulso_numero');

                    // 3. Calcular Valor Líquido (Documento - Desconto)
                    const valorBruto = parseCurrency(formData.document_value);
                    const valorDesconto = parseCurrency(formData.desconto_value);
                    const valorLiquido = valorBruto - valorDesconto;

                    // 4. Inserir na tabela de recibos avulsos
                    const { data: newRecibo, error: insertError } = await supabase
                      .from('recibos_avulso')
                      .insert({
                        tipo: 'fornecedor', // Débito geralmente é fornecedor
                        pessoa_id: formData.pessoa_id,
                        pessoa_nome: formData.cliente_fornecedor_name,
                        pessoa_cnpj_cpf: unmask(formData.cnpj_cpf || ''),
                        pessoa_endereco: person?.endereco,
                        pessoa_municipio: person?.municipio,
                        pessoa_estado: person?.estado,
                        pessoa_telefone: unmask(person?.telefone || ''),
                        pessoa_email: person?.email,
                        descricao: formData.description,
                        valor: valorLiquido,
                        data_recibo: format(new Date(formData.issue_date), 'yyyy-MM-dd'),
                        numero_recibo: numero,
                        user_id: user.id
                      })
                      .select()
                      .single();

                    if (insertError) throw insertError;

                    await logAction('create_recibo_from_financeiro_success', {
                      recibo_id: newRecibo.id,
                      lancamento_id: LancarId
                    });

                    // Navega para a lista de recibos informando qual abrir e para onde voltar
                    navigate('/app/financeiro/recibos', {
                      state: {
                        openReciboId: newRecibo.id,
                        returnPath: `/app/financeiro/${type}`
                      }
                    });

                  } catch (err) {
                    console.error("Erro ao gerar recibo:", err);
                    toast({
                      title: "Erro ao gerar recibo",
                      description: err.message,
                      variant: "destructive"
                    });
                  }
                }}
              >
                Sim, Gerar
              </Button>
            </div>
          ),
        });
      } else {
        navigate(`/app/financeiro/${type}`);
      }

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
                costCenterListVersion={costCenterListVersion}
                isNewClientModalOpen={isNewClientModalOpen}
                setIsNewClientModalOpen={setIsNewClientModalOpen}
                isNewCostCenterModalOpen={isNewCostCenterModalOpen}
                setIsNewCostCenterModalOpen={setIsNewCostCenterModalOpen}
                handleNewClientSuccess={handleNewClientSuccess}
                handleNewCostCenterSuccess={handleNewCostCenterSuccess}
                onDocumentValueChange={handleDocumentValueChange}
                onDescontoChange={handleDescontoChange}
                onInterestChange={handleInterestChange}
                isEditing={isEditing}
                documentNumberRef={documentNumberRef}
              />

              <InstallmentDetails
                formData={formData}
                handleInputChange={handleInputChange}
                downPaymentInputRef={downPaymentInputRef}
                downPaymentError={downPaymentError}
                singleDueDate={formData.single_due_date}
                setSingleDueDate={(date) => handleUpdateRawFormData({ single_due_date: date })}
                parsedTotalValue={parsedTotalValue}
                parsedDownPayment={parsedDownPayment}
                // ✅ CORREÇÃO: Esconder se saldo for zero, mesmo na edição
                showInstallments={(parsedTotalValue - parsedDownPayment > 0.01) || (formData.installments?.length > 0)}
                handleInstallmentsChange={handleInstallmentsChange}
                onInstallmentsNumberChange={(n) => handleUpdateRawFormData({ installments_number: n })}
                existingInstallments={existingInstallments}
                isEditing={isEditing}
              />

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
                    {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Lançar'}
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