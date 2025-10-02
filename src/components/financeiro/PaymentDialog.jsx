import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, Banknote } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatCurrency, parseCurrency, formatToISODate } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { IMaskInput } from 'react-imask';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const PaymentDialog = ({ isOpen, onClose, entry, onSuccess, initialPaidAmount, initialPaymentMethod }) => {
  const { toast } = useToast();
  const [paidAmount, setPaidAmount] = useState(initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : '0,00');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod || 'pix');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false); // Existing loading state for initial data fetch
  const [isSubmitting, setIsSubmitting] = useState(false); // NOVO: Estado para controlar o envio do formulário
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const parsedPaidAmount = parseCurrency(paidAmount);
  const remainingBalance = entry ? entry.amount_balance : 0;

  useEffect(() => {
    if (entry) {
      setPaidAmount(initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : String(entry.amount_balance).replace('.', ','));
      setPaymentDate(new Date());
      setPaymentMethod(initialPaymentMethod || 'pix');
      setNotes('');
    }
  }, [entry, initialPaidAmount, initialPaymentMethod]);

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true); // Set loading for account fetch
      const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('cnpj').single();
      if (empresaError) {
        console.error('Erro ao buscar CNPJ da empresa:', empresaError);
        toast({ title: 'Erro', description: 'Não foi possível carregar o CNPJ da empresa.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('conta_corrente')
        .select('*')
        .eq('cnpj_empresa', empresaData?.cnpj)
        .order('is_default', { ascending: false });

      if (error) {
        console.error('Erro ao buscar contas correntes:', error);
        toast({ title: 'Erro', description: 'Não foi possível carregar as contas bancárias.', variant: 'destructive' });
      } else {
        setAccounts(data || []);
        if (data.length > 0) {
          setSelectedAccount(data.find(acc => acc.is_default)?.id || data[0].id);
        }
      }
      setLoading(false); // Unset loading after account fetch
    };
    fetchAccounts();
  }, [toast]);

  const handleRegisterPayment = async () => {
    if (!entry) {
      toast({ title: 'Erro', description: 'Nenhum lançamento selecionado para pagamento.', variant: 'destructive' });
      return;
    }
    if (parsedPaidAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'O valor a pagar deve ser maior que zero.', variant: 'destructive' });
      return;
    }
    if (parsedPaidAmount > remainingBalance) {
      toast({ title: 'Valor excedente', description: `O valor a pagar não pode ser maior que o saldo devedor (${formatCurrency(remainingBalance)}).`, variant: 'destructive' });
      return;
    }
    if (!paymentDate) {
      toast({ title: 'Data inválida', description: 'Por favor, selecione a data do pagamento.', variant: 'destructive' });
      return;
    }
    if (!paymentMethod) {
      toast({ title: 'Método de pagamento', description: 'Por favor, selecione a forma de pagamento.', variant: 'destructive' });
      return;
    }
    if (!selectedAccount) {
      toast({ title: 'Conta de Movimento', description: 'Por favor, selecione a conta de movimento.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true); // Ativa o estado de envio
    try {
      const { data, error } = await supabase.rpc('register_payment', {
        p_credito_debito_id: entry.id,
        p_paid_amount: parsedPaidAmount,
        p_payment_date: formatToISODate(paymentDate),
        p_payment_method: paymentMethod,
        p_notes: notes,
        p_installment_number: entry.installment_number,
        p_due_date: entry.issue_date,
        p_expected_amount: entry.total_value,
        p_conta_corrente_id: selectedAccount,
      });

      if (error || (data && !data.success)) {
        throw new Error(error?.message || data?.message || 'Erro desconhecido ao registrar pagamento.');
      }

      toast({ title: 'Pagamento registrado!', description: 'O pagamento foi salvo e o saldo atualizado.', variant: 'success' });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false); // Desativa o estado de envio
    }
  };

  const getClientDisplayName = (entryData) => {
    return entryData.cliente_fornecedor_fantasy_name ? `${entryData.cliente_fornecedor_name} - ${entryData.cliente_fornecedor_fantasy_name}` : entryData.cliente_fornecedor_name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-400" /> Registrar Pagamento
          </DialogTitle>
          <DialogDescription className="text-emerald-300">
            Preencha os detalhes para registrar o pagamento d{entry?.type === 'credito' ? 'o crédito' : 'o débito'}.
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-2 text-sm">
            <p className="text-emerald-200">Para: <span className="font-bold">{getClientDisplayName(entry)}</span></p>
            <p className="text-emerald-200">{entry.description}</p>
            <p className="text-emerald-200">Valor da Parcela: <span className="font-bold">{formatCurrency(entry.total_value)}</span></p>
            <p className="text-emerald-200">Valor Pago: <span className="font-bold">{formatCurrency(entry.paid_amount)}</span></p>
            <p className="text-yellow-400 text-lg font-bold">Saldo Devedor: {formatCurrency(remainingBalance)}</p>
          </div>
        )}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paymentMethod" className="text-white">Forma de Pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSubmitting || loading}>
              <SelectTrigger className="bg-white/10 border-white/30 text-white">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account" className="text-white">Conta Movimento *</Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={isSubmitting || loading}>
              <SelectTrigger className="bg-white/10 border-white/30 text-white">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {loading ? (
                  <SelectItem value="loading" disabled>Carregando contas...</SelectItem>
                ) : accounts.length > 0 ? (
                  accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.banco} - Ag: {account.agencia} - Cta: {account.conta} {account.is_default && '(Padrão)'}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-accounts" disabled>Nenhuma conta encontrada</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidAmount" className="text-white">Valor a Pagar (R$) *</Label>
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
              as={Input}
              id="paidAmount"
              type="text"
              value={paidAmount}
              onAccept={(value) => setPaidAmount(value)}
              placeholder="0,00"
              className="bg-white/10 border-white/30 text-white placeholder:text-white/60"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Data do Pagamento *
            </Label>
            <DatePicker
              date={paymentDate}
              setDate={setPaymentDate}
              className="w-full bg-white/10 border-white/30 text-white placeholder:text-white/60"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white">Observações</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione uma observação sobre o pagamento..."
              className="bg-white/10 border-white/30 text-white placeholder:text-white/60"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" onClick={handleRegisterPayment} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};