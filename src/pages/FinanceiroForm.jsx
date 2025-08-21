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
// Removido import de InstallmentTable
import { Textarea } from '@/components/ui/textarea';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

const paymentMethods = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'bank_transfer', label: 'Transferência Bancária' },
  { value: 'other', label: 'Outro' },
];

const costCenters = [
  { value: 'ADMINISTRAÇÃO', label: 'ADMINISTRAÇÃO' },
  { value: 'VENDAS', label: 'VENDAS' },
  { value: 'OPERACIONAL', label: 'OPERACIONAL' },
  { value: 'MARKETING', label: 'MARKETING' },
  { value: 'OUTROS', label: 'OUTROS' },
];

const FinanceiroForm = ({ type }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id);
  // Removido downPaymentInputRef

  const [formData, setFormData] = useState({
    document_number: '',
    issue_date: new Date(), // Data de emissão
    model: 'Recibo',
    pessoa_id: null,
    cliente_fornecedor_name: '',
    cnpj_cpf: '',
    description: '',
    total_value: 0, 
    payment_method: 'pix',
    cost_center: 'ADMINISTRAÇÃO',
    notes: '',
    // Removidos down_payment, installments_number, installments
  });
  
  const [dueDate, setDueDate] = useState(addDays(new Date(), 30)); // Data de vencimento única
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Removidos existingInstallments e downPaymentError

  const title = type === 'credito' ? 'Crédito' : 'Débito';
  const entityLabel = type === 'credito' ? 'Cliente' : 'Fornecedor';

  const parsedTotalValue = Number(formData.total_value);
  // Removido parsedDownPayment e useEffect de downPaymentError

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
      return;
    }
    // Edição de lançamento: função ainda não implementada
    setLoading(true);
    toast({
        title: 'Função em Desenvolvimento',
        description: 'A edição de lançamentos financeiros está sendo ajustada. Por favor, exclua o lançamento e crie-o novamente.',
        variant: 'destructive',
        duration: 10000,
    });
    navigate(`/app/financeiro/${type}`);
    setLoading(false);
  }, [id, isEditing, navigate, toast, type]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNumericInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value === null ? 0 : Number(value) }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleIssueDateChange = (date) => {
    // Compara o valor da data para evitar atualizações desnecessárias
    const newDateISO = date ? format(date, 'yyyy-MM-dd') : null;
    const currentIssueDateISO = formData.issue_date ? format(formData.issue_date, 'yyyy-MM-dd') : null;

    if (newDateISO !== currentIssueDateISO) {
      setFormData((prev) => ({ ...prev, issue_date: date || new Date() }));
    }
  };

  const handleDueDateChange = (date) => {
    setDueDate(date || new Date());
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

  // Removido handleInstallmentsChange e showInstallments

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.document_number.trim() || !formData.cliente_fornecedor_name.trim() || !unmask(formData.cnpj_cpf).trim() || !formData.issue_date || !formData.description.trim() || parsedTotalValue <= 0 || !dueDate) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios (Nº Doc, Cliente/Fornecedor, CNPJ/CPF, Descrição, Valor Total, Vencimento).', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (isEditing) {
        toast({ title: 'Função em Desenvolvimento', description: 'A edição de lançamentos financeiros está sendo ajustada.', variant: 'destructive' });
        setSaving(false);
        return;
    }

    const lancamentoId = uuidv4();
    
    // Lógica simplificada para pagamento único
    const installmentsPayload = [{
        amount: parsedTotalValue,
        date: format(dueDate, 'yyyy-MM-dd'),
        number: 1 // Sempre parcela 1
    }];
    const totalInstallmentsCount = 1; // Sempre 1 parcela

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
        p_down_payment: null, // Não há entrada separada
        p_installments: installmentsPayload
    };

    const { data, error } = await supabase.rpc('create_financeiro_lancamento', rpcParams);

    if (error || (data && !data.success)) {
      const errorMessage = error?.message || data?.message || 'Ocorreu um erro desconhecido.';
      toast({ title: `Erro ao cadastrar ${title}`, description: errorMessage, variant: 'destructive' });
      await logAction(`create_${type}_failed`, { error: errorMessage, entry_description: formData.description });
    } else {
      toast({ title: `${title} cadastrado com sucesso!`, description: `${formData.description} foi salvo.` });
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
                    setDate={handleIssueDateChange}
                  />
                </div>
                <div className="md:col-span-2 relative z-10">
                  <ClientOrManualInput
                    labelText={entityLabel}
                    selectedClientId={formData.pessoa_id}
                    onSelectClient={handleClientSelectId}
                    clientName={formData.cliente_fornecedor_name}
                    onClientNameChange={handleClientNameChange}
                    cnpjCpf={formData.cnpj_cpf}
                    onCnpjCpfChange={handleCnpjCpfChange}
                  />
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
                <div>
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
                    value={String(formData.total_value)}
                    onAccept={(value) => handleNumericInputChange('total_value', value)}
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
                {/* Removido campo de Valor de Entrada */}
                <div>
                  <Label htmlFor="due_date" className="text-lg">Vencimento <span className="text-red-500">*</span></Label>
                  <DateInput date={dueDate} setDate={handleDueDateChange} />
                </div>
                
                {/* Removido campo de Saldo e Número de Parcelas */}
              </div>

              {/* Removido InstallmentTable */}

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