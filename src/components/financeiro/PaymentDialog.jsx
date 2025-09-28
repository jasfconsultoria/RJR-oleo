import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Loader2, Banknote, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { formatCurrency, parseCurrency, formatDateWithTimezone, formatToISODate } from '@/lib/utils';
import { IMaskInput } from 'react-imask';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PaymentDialog = ({ isOpen, onClose, entry, onSuccess, initialPaidAmount = 0, initialPaymentMethod = 'pix' }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod);
  const [notes, setNotes] = useState('');
  const [paidAmount, setPaidAmount] = useState(String(initialPaidAmount).replace('.', ',')); // Initialize with initialPaidAmount
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');

  const parsedPaidAmount = useMemo(() => parseCurrency(paidAmount), [paidAmount]);
  const parsedEntryTotalValue = useMemo(() => parseCurrency(String(entry?.total_value || '0').replace('.', ',')), [entry]);
  const parsedEntryPaidAmount = useMemo(() => parseCurrency(String(entry?.paid_amount || '0').replace('.', ',')), [entry]);
  const parsedEntryAmountBalance = useMemo(() => parseCurrency(String(entry?.amount_balance || '0').replace('.', ',')), [entry]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('timezone').single();
      if (data?.timezone) {
        setEmpresaTimezone(data.timezone);
      }
    };
    fetchEmpresaData();
  }, []);

  useEffect(() => {
    if (entry && isOpen) {
      // Initialize paidAmount with the remaining balance if it's not zero
      const balance = parseCurrency(String(entry.amount_balance || '0').replace('.', ','));
      setPaidAmount(balance > 0 ? String(balance).replace('.', ',') : '0,00');
      setPaymentDate(new Date());
      setPaymentMethod(initialPaymentMethod);
      setNotes('');
      setSelectedAccount(''); // Reset selected account
      fetchAccounts();
    }
  }, [entry, isOpen, initialPaymentMethod]);

  const fetchAccounts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('cnpj').single();
      if (empresaError) throw empresaError;

      const { data: accountsData, error: accountsError } = await supabase
        .from('conta_corrente')
        .select('*')
        .eq('cnpj_empresa', empresaData.cnpj)
        .order('is_default', { ascending: false });

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);
      
      // Set default account if available and none selected
      if (accountsData?.length > 0 && !selectedAccount) {
        const defaultAccount = accountsData.find(acc => acc.is_default);
        setSelectedAccount(defaultAccount?.id || accountsData[0].id);
      }
    } catch (error) {
      toast({ title: 'Erro ao buscar contas bancárias', description: error.message, variant: 'destructive' });
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast, selectedAccount]);

  const handleRegisterPayment = async () => {
    if (parsedPaidAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'O valor do pagamento deve ser maior que zero.', variant: 'destructive' });
      return;
    }
    if (!selectedAccount) {
      toast({ title: 'Conta de Movimento Obrigatória', description: 'Por favor, selecione uma conta de movimento.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('register_payment', {
        p_credito_debito_id: entry.id,
        p_paid_amount: parsedPaidAmount,
        p_payment_date: formatToISODate(paymentDate),
        p_payment_method: paymentMethod,
        p_notes: notes,
        p_installment_number: entry.installment_number,
        p_due_date: formatToISODate(entry.issue_date), // Use issue_date as due_date for the payment record
        p_expected_amount: entry.total_value, // Use total_value as expected_amount for the payment record
        p_conta_corrente_id: selectedAccount,
      });

      if (error || !data.success) {
        throw new Error(error?.message || data?.message || 'Erro desconhecido ao registrar pagamento.');
      }

      toast({ title: 'Pagamento registrado!', description: data.message });
      onSuccess();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = loading || parsedPaidAmount <= 0 || !selectedAccount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Para: <span className="font-bold">{entry?.cliente_fornecedor_name}</span> - {entry?.description}
            <div className="mt-2 flex justify-between text-sm">
              <span>Valor da Parcela: <span className="font-bold">{formatCurrency(parsedEntryTotalValue)}</span></span>
              <span>Valor Pago: <span className="font-bold">{formatCurrency(parsedEntryPaidAmount)}</span></span>
            </div>
            <div className="mt-1 text-lg font-bold">
              Saldo Devedor: <span className="text-yellow-400">{formatCurrency(parsedEntryAmountBalance)}</span>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Forma de Pagamento *</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger id="paymentMethod" className="bg-white/10 border-white/30 text-white">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contaMovimento" className="flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Conta Movimento *
            </Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount} disabled={loading}>
              <SelectTrigger id="contaMovimento" className="bg-white/10 border-white/30 text-white">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {accounts.length > 0 ? (
                  accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.banco} - Ag: {account.agencia} - Cta: {account.conta} {account.is_default ? '(Padrão)' : ''}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-accounts" disabled>Nenhuma conta disponível</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="paidAmount">Valor a Pagar (R$) *</Label>
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
              className="bg-white/10 border-white/30 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Data do Pagamento *
            </Label>
            <DatePicker
              date={paymentDate}
              setDate={setPaymentDate}
              className="w-full bg-white/10 border-white/30 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-2">
              <Info className="w-4 h-4" /> Observações
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione uma observação sobre o pagamento..."
              className="bg-white/10 border-white/30 text-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" onClick={handleRegisterPayment} disabled={isSubmitDisabled}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;