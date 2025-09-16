import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, DollarSign, Loader2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/logger';
import ClientOrManualInput from '@/components/financeiro/ClientOrManualInput';
import { formatCnpjCpf, unmask, parseCurrency, formatCurrency } from '@/lib/utils';
import { DateInput } from '@/components/ui/date-input';
import { isValid, parseISO, addDays } from 'date-fns';
import InstallmentTable from '@/components/financeiro/InstallmentTable';
import { Textarea } from '@/components/ui/textarea';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ClienteForm from './ClienteForm';
import CentroCustoForm from './CentroCustoForm';
import { PlusCircle } from 'lucide-react';

const paymentMethods = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'bank_transfer', label: 'Transferência Bancária' },
  { value: 'other', label: 'Outro' },
];

const FinanceiroForm = ({ type }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id);
  const downPaymentInputRef = useRef(null);

  const [formData, setFormData] = useState({
    document_number: '',
    issue_date: new Date(),
    model: 'Recibo',
    pessoa_id: null,
    cliente_fornecedor_name: '',
    cnpj_cpf: '',
    description: '',
    total_value: '',
    payment_method: 'pix',
    cost_center: 'ADMINISTRAÇÃO', // Default, will be updated by fetched data
    notes: '',
    down_payment: '0,00',
    installments_number: 1,
    installments: [],
  });
  
  const [singleDueDate, setSingleDueDate] = useState(addDays(new Date(), 30));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingInstallments, setExistingInstallments] = useState([]);
  const [downPaymentError, setDownPaymentError] = useState('');
  const [costCenters, setCostCenters] = useState([]); // State for dynamic cost centers
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewCostCenterModalOpen, setIsNewCostCenterModalOpen] = useState(false);
  const [clientListVersion, setClientListVersion] = useState(0);

  const title = type === 'credito' ? 'Crédito' : 'Débito';
  const entityLabel = type === 'credito' ? 'Cliente' : 'Fornecedor';

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
        setFormData(prev => ({ ...prev, cost_center: data[0].nome }));
      }
    }
  }, [toast, formData.cost_center]);

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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setFormData((prev) => ({ ...prev, issue_date: date }));
  };

  const handleClientSelectId = (clientId) => {
    setFormData((prev) => ({ ...prev, pessoa_id: clientId }));
  };

  const handleClientNameChange = (name) => {
    setFormData((prev) => ({ ...prev, cliente_fornecedor_name: name }));
  };

  const handleCnpjCpfChange = (cnpjCpfValue) => {
    setFormData((prev) => ({ ...prev, cnpj_cpf: cnpjCpfValue }));
  };

  const handleInstallmentsChange = useCallback((installmentsData) => {
    setFormData((prev) => ({ ...prev, installments: installmentsData }));
  }, []);

  const showInstallments = parsedTotalValue > 0 && parsedDownPayment >= 0 && parsedTotalValue > parsedDownPayment;

  useEffect(() => {
    if (!showInstallments) {
      handleInstallmentsChange([]);
    }
  }, [showInstallments, handleInstallmentsChange]);

  const handleNewClientSuccess = (newClient) => {
    setIsNewClientModalOpen(false);
    setClientListVersion(v => v + 1);
    // Automatically select the new client
    setFormData(prev => ({
      ...prev,
      pessoa_id: newClient.id,
      cliente_fornecedor_name: newClient.nome,
      cnpj_cpf: newClient.cnpj_cpf,
    }));
    // ClientOrManualInput will update its internal state based on these props
  };

  const handleNewCostCenterSuccess = (newCostCenter) => {
    setIsNewCostCenterModalOpen(false);
    fetchCostCenters(); // Refresh the list of cost centers
    setFormData(prev => ({ ...prev, cost_center: newCostCenter.nome })); // Select the new cost center
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
            date: format(singleDueDate, 'yyyy-MM-dd'),
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
      navigate(`/app/financeiro/${type}`);
    }
    setSaving(false);
  };

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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="document_number" className="text-lg">Nº Doc. <span className="text-red-500">*</span></Label>
                  <Input id="document_number" name="document_number" value={formData.document_number} onChange={handleInputChange} placeholder="Ex: 001/2025" className="bg-white/5 border-white/20 rounded-xl" required />
                </div>
                <div>
                  <Label htmlFor="issue_date" className="text-lg">Emissão <span className="text-red-500">*</span></Label>
                  <DateInput
                    date={formData.issue_date}
                    setDate={handleDateChange}
                  />
                </div>
                <div className="md:col-span-2 relative z-10 flex items-end gap-2"> {/* Added flex and gap */}
                  <div className="flex-grow"> {/* Make ClientOrManualInput take available space */}
                    <ClientOrManualInput
                      labelText={entityLabel}
                      selectedClientId={formData.pessoa_id}
                      onSelectClient={handleClientSelectId}
                      clientName={formData.cliente_fornecedor_name}
                      onClientNameChange={handleClientNameChange}
                      cnpjCpf={formData.cnpj_cpf}
                      onCnpjCpfChange={handleCnpjCpfChange}
                      refetchTrigger={clientListVersion}
                    />
                  </div>
                  <Dialog open={isNewClientModalOpen} onOpenChange={setIsNewClientModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                        <PlusCircle className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px] bg-gray-800 text-white border-gray-700 rounded-xl">
                      <DialogHeader>
                        <DialogTitle className="text-emerald-300">Novo {entityLabel}</DialogTitle>
                      </DialogHeader>
                      <ClienteForm isModal onSaveSuccess={handleNewClientSuccess} personType={type === 'credito' ? 'cliente' : 'fornecedor'} />
                    </DialogContent>
                  </Dialog>
                </div>
                <div>
                  <Label htmlFor="cnpj_cpf" className="text-lg">CNPJ/CPF <span className="text-red-500">*</span></Label>
                  <IMaskInput
                    mask={[
                      { mask: '000.000.000-00', maxLength: 11 },
                      { mask: '00.000.000/0000-00' }
                    ]}
                    as={Input}
                    id="cnpj_cpf"
                    name="cnpj_cpf"
                    value={formData.cnpj_cpf}
                    onAccept={(value) => handleCnpjCpfChange(String(value))}
                    placeholder="Digite o CNPJ ou CPF"
                    className="w-full flex h-10 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm"
                    disabled={!!formData.pessoa_id}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="model" className="text-lg">Modelo</Label>
                  <Select value={formData.model} onValueChange={(value) => handleSelectChange('model', value)}>
                    <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                      <SelectItem value="Recibo">Recibo</SelectItem>
                      <SelectItem value="NF">Nota Fiscal</SelectItem>
                      <SelectItem value="Fatura">Fatura</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description" className="text-lg">Descrição <span className="text-red-500">*</span></Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Descrição da obra / evento..." required className="bg-white/5 border-white/20 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="payment_method" className="text-lg">Forma de Pagamento <span className="text-red-500">*</span></Label>
                  <Select value={formData.payment_method} onValueChange={(value) => handleSelectChange('payment_method', value)}>
                    <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
                      <SelectValue placeholder="Selecione a forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                      {paymentMethods.map(method => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2"> {/* Added flex and gap */}
                  <div className="flex-grow"> {/* Make Select take available space */}
                    <Label htmlFor="cost_center" className="text-lg">Centro de Custo</Label>
                    <Select value={formData.cost_center} onValueChange={(value) => handleSelectChange('cost_center', value)}>
                      <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
                        <SelectValue placeholder="Selecione o centro de custo" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                        {costCenters.map(center => <SelectItem key={center.value} value={center.value}>{center.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isNewCostCenterModalOpen} onOpenChange={setIsNewCostCenterModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
                        <PlusCircle className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] bg-gray-800 text-white border-gray-700 rounded-xl">
                      <DialogHeader>
                        <DialogTitle className="text-emerald-300">Novo Centro de Custo</DialogTitle>
                      </DialogHeader>
                      <CentroCustoForm isModal onSaveSuccess={handleNewCostCenterSuccess} />
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="total_value" className="text-lg">Valor Total (R$) <span className="text-red-500">*</span></Label>
                  <IMaskInput
                    mask="num"
                    blocks={{
                      num: {
                        mask: Number,
                        thousandsSeparator: '.',
                        radix: ',',
                        mapToRadix: ['.'],
                        scale: 2,
                        padFractionalZeros: true,
                        normalizeZeros: true,
                        signed: false,
                      },
                    }}
                    value={formData.total_value}
                    onAccept={(value) => handleInputChange({ target: { name: 'total_value', value: value } })}
                    placeholder="0,00"
                    className="w-full flex h-10 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes" className="text-lg">Referente / Observação</Label>
                  <Textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="Informações adicionais..." className="bg-white/5 border-white/20 rounded-xl" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/20">
                <div>
                  <Label htmlFor="down_payment" className="text-lg">Valor de Entrada (R$)</Label>
                  <IMaskInput
                    ref={downPaymentInputRef}
                    mask="num"
                    blocks={{
                      num: {
                        mask: Number,
                        thousandsSeparator: '.',
                        radix: ',',
                        mapToRadix: ['.'],
                        scale: 2,
                        padFractionalZeros: true,
                        normalizeZeros: true,
                        signed: false,
                      },
                    }}
                    value={formData.down_payment}
                    onAccept={(value) => handleInputChange({ target: { name: 'down_payment', value: value } })}
                    placeholder="0,00"
                    className={`w-full flex h-10 rounded-xl border ${downPaymentError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                  />
                  {downPaymentError && <p className="text-red-500 text-xs mt-1">{downPaymentError}</p>}
                </div>
                <div>
                  {parsedDownPayment === 0 && parsedTotalValue > 0 && (
                    <>
                      <Label htmlFor="single_due_date" className="text-lg">Vencimento</Label>
                      <DateInput date={singleDueDate} setDate={setSingleDueDate} />
                    </>
                  )}
                  {parsedDownPayment > 0 && (
                    <>
                      <Label htmlFor="down_payment_due_date" className="text-lg">Vencimento da Entrada</Label>
                      <Input 
                        id="down_payment_due_date"
                        value={format(formData.issue_date, 'dd/MM/yyyy')}
                        disabled
                        className="bg-white/5 border-white/20 rounded-xl"
                      />
                    </>
                  )}
                </div>
                
                {parsedTotalValue > 0 && (
                  <>
                    <div>
                      <Label htmlFor="saldo" className="text-lg">Saldo (R$)</Label>
                      <Input
                        id="saldo"
                        value={formatCurrency(parsedTotalValue - parsedDownPayment)}
                        disabled
                        className="bg-white/5 border-white/20 rounded-xl font-bold"
                      />
                    </div>
                    <div>
                      {showInstallments && (
                        <>
                          <Label htmlFor="installments_number" className="text-lg">Número de Parcelas</Label>
                          <Input
                            id="installments_number"
                            name="installments_number"
                            type="number"
                            min="1"
                            value={formData.installments_number}
                            onChange={(e) => handleInputChange({ target: { name: 'installments_number', value: parseInt(e.target.value, 10) || 1 } })}
                            className="bg-white/5 border-white/20 rounded-xl"
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {showInstallments && formData.installments_number > 0 && (
                <InstallmentTable
                  totalValue={parseCurrency(formData.total_value)}
                  downPayment={parseCurrency(formData.down_payment)}
                  installmentsNumber={formData.installments_number}
                  issueDate={formData.issue_date}
                  onInstallmentsChange={handleInstallmentsChange}
                  existingInstallments={existingInstallments}
                  isEditing={isEditing}
                />
              )}

              <div className="flex justify-between items-center pt-6">
                <Button type="button" onClick={() => navigate(`/app/financeiro/${type}`)} variant="outline" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                  {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default FinanceiroForm;