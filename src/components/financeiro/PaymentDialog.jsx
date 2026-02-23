"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, DollarSign, Banknote, Info, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatCurrency, parseCurrency, formatDateWithTimezone } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { IMaskInput } from 'react-imask';
import { logAction } from '@/lib/logger';

const PaymentDialog = ({ isOpen, onClose, entry, onSuccess, initialPaidAmount, initialPaymentMethod }) => {
  const [paidAmount, setPaidAmount] = useState(initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : '0,00');
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [paymentMethod, setPaymentMethod] = useState(initialPaymentMethod || 'pix');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const { toast } = useToast();

  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');

  useEffect(() => {
    const fetchEmpresaTimezone = async () => {
      const { data, error } = await supabase.from('empresa').select('timezone').single();
      if (data?.timezone) {
        setEmpresaTimezone(data.timezone);
      }
    };
    fetchEmpresaTimezone();
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!entry) return;
    const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('cnpj').single();
    if (empresaError) {
      toast({ title: 'Erro', description: 'Não foi possível carregar o CNPJ da empresa.', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase
      .from('conta_corrente')
      .select('*')
      .eq('cnpj_empresa', empresaData.cnpj)
      .order('is_default', { ascending: false });

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível carregar as contas bancárias.', variant: 'destructive' });
    } else {
      setAccounts(data || []);
      const defaultAccount = data.find(acc => acc.is_default);
      if (defaultAccount) {
        setSelectedAccount(defaultAccount.id);
      } else if (data.length > 0) {
        setSelectedAccount(data[0].id);
      }
    }
  }, [entry, toast]);

  useEffect(() => {
    if (isOpen && entry) {
      setPaidAmount(initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : String(entry.amount_balance || '0,00').replace('.', ','));
      setPaymentDate(new Date());
      setPaymentMethod(initialPaymentMethod || 'pix');
      setNotes('');
      fetchAccounts();
    }
  }, [isOpen, entry, fetchAccounts, initialPaidAmount, initialPaymentMethod]);

  const handleRegisterPayment = async () => {
    setIsSubmitting(true);
    const parsedPaidAmount = parseCurrency(paidAmount);

    if (parsedPaidAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'O valor a pagar deve ser maior que zero.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    if (!paymentDate) {
      toast({ title: 'Data inválida', description: 'Por favor, selecione a data do pagamento.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    if (!selectedAccount) {
      toast({ title: 'Conta de Movimento', description: 'Por favor, selecione uma conta de movimento.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('register_payment', {
        p_credito_debito_id: entry.id,
        p_paid_amount: parsedPaidAmount,
        p_payment_date: paymentDate.toISOString().split('T')[0], // Format to YYYY-MM-DD
        p_payment_method: paymentMethod,
        p_notes: notes,
        p_installment_number: entry.installment_number,
        p_due_date: entry.issue_date,
        p_expected_amount: entry.installment_value || entry.total_value,
        p_conta_corrente_id: selectedAccount,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      toast({ title: 'Pagamento registrado', description: data.message, variant: 'success' });
      await logAction('register_payment_success', {
        entry_id: entry.id,
        payment_id: data.payment_id,
        paid_amount: parsedPaidAmount,
        payment_method: paymentMethod,
        account_id: selectedAccount,
      });
      onSuccess();
      onClose();
    } catch (error) {
      toast({ title: 'Erro ao registrar pagamento', description: error.message, variant: 'destructive' });
      await logAction('register_payment_failed', {
        entry_id: entry.id,
        error: error.message,
        paid_amount: parsedPaidAmount,
        payment_method: paymentMethod,
        account_id: selectedAccount,
      });
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const getAccountDisplayName = (account) => {
    if (!account) return 'N/A';
    const defaultTag = account.is_default ? ' (Padrão)' : '';
    return `${account.banco} - Ag: ${account.agencia} - Cta: ${account.conta}${defaultTag}`;
  };

  const entryTypeLabel = entry?.type === 'credito' ? 'receber' : 'pagar';
  const entityName = entry?.cliente_fornecedor_fantasy_name ? `${entry.cliente_fornecedor_name} - ${entry.cliente_fornecedor_fantasy_name}` : entry?.cliente_fornecedor_name;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Para: <span className="font-bold">{entityName}</span> - Pagamento de {entry?.description}.
          </DialogDescription>
          <div className="mt-2 text-sm text-emerald-200">
            <p>Valor da Parcela: <span className="font-bold text-white">{formatCurrency(entry?.installment_value || entry?.total_value || 0)}</span></p>
            <p>Valor Pago: <span className="font-bold text-white">{formatCurrency(entry?.paid_amount || 0)}</span></p>
            <p className="text-lg font-bold text-yellow-400">Saldo Devedor: {formatCurrency(entry?.amount_balance || 0)}</p>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="paymentMethod" className="text-white flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Forma de Pagamento *
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="bg-white/10 border-white/30 text-white rounded-xl h-10 text-base">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                <SelectItem value="debit_card">Cartão de Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account" className="text-white flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Conta Movimento *
            </Label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="bg-white/10 border-white/30 text-white rounded-xl h-10 text-base">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                {accounts.length > 0 ? (
                  accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {getAccountDisplayName(acc)}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-accounts" disabled>Nenhuma conta cadastrada</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidAmount" className="text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Valor a Pagar (R$) *
            </Label>
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
              lazy={false}
              onAccept={(value) => setPaidAmount(value)}
              placeholder="0,00"
              inputMode="decimal"
              className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base px-3 py-2 !text-right"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate" className="text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Data do Pagamento *
            </Label>
            <DatePicker
              date={paymentDate}
              setDate={setPaymentDate}
              className="w-full bg-white/10 border-white/30 text-white rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-white flex items-center gap-2">
              <Info className="w-4 h-4" /> Observações
            </Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione uma observação sobre o pagamento..."
              className="bg-white/10 border-white/30 text-white placeholder:text-white/60 rounded-xl h-10 text-base"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleRegisterPayment} disabled={isSubmitting || !selectedAccount} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? 'Registrando...' : 'Registrar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;