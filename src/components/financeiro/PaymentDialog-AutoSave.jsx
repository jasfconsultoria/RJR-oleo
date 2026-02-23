"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { useAutoSave } from '@/hooks/useAutoSave';

const PaymentDialog = ({ isOpen, onClose, entry, onSuccess, initialPaidAmount, initialPaymentMethod }) => {
  const getEmptyFormData = () => ({
    paidAmount: initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : String(entry?.amount_balance || '0,00').replace('.', ','),
    paymentDate: new Date(),
    paymentMethod: initialPaymentMethod || 'pix',
    notes: '',
    selectedAccount: null
  });

  const autoSaveKey = entry ? `paymentDialog_${entry.id}` : `paymentDialog_new`;
  const [formData, setFormData, clearSavedData] = useAutoSave(
    autoSaveKey,
    getEmptyFormData(),
    true
  );

  const [paidAmount, setPaidAmount] = useState(formData.paidAmount);
  const [paymentDate, setPaymentDate] = useState(formData.paymentDate);
  const [paymentMethod, setPaymentMethod] = useState(formData.paymentMethod);
  const [notes, setNotes] = useState(formData.notes);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(formData.selectedAccount);
  const { toast } = useToast();

  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);
  const wasOpen = useRef(false);
  const currentEntryId = useRef(null);

  // ✅ CORREÇÃO 1: Resetar quando o entry mudar (dialog fechado)
  useEffect(() => {
    if (!isOpen && entry && currentEntryId.current !== entry.id) {
      wasOpen.current = false;
      currentEntryId.current = entry.id;
      // Limpa auto-save de entry anterior
      clearSavedData();
    }
  }, [isOpen, entry, clearSavedData]);

  // ✅ CORREÇÃO 2: Sincronizar estados com formData
  useEffect(() => {
    setFormData({
      paidAmount,
      paymentDate,
      paymentMethod,
      notes,
      selectedAccount
    });
  }, [paidAmount, paymentDate, paymentMethod, notes, selectedAccount, setFormData]);

  // ✅ CORREÇÃO 3: Verificar auto-save apenas quando aberto
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const saved = localStorage.getItem(autoSaveKey);
      setHasAutoSaveData(!!saved);
    }
  }, [isOpen, autoSaveKey]);

  // ✅ CORREÇÃO 4: Atualizar wasOpen apenas quando realmente abrir
  useEffect(() => {
    if (isOpen && entry) {
      wasOpen.current = true;
      currentEntryId.current = entry.id;
    }
  }, [isOpen, entry]);

  // ✅ CORREÇÃO 5: Reset apenas quando fecha E era o mesmo entry
  useEffect(() => {
    if (!isOpen && wasOpen.current && entry && currentEntryId.current === entry.id) {
      const timer = setTimeout(() => {
        setPaidAmount(initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : String(entry?.amount_balance || '0,00').replace('.', ','));
        setPaymentDate(new Date());
        setPaymentMethod(initialPaymentMethod || 'pix');
        setNotes('');
        setSelectedAccount(null);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, entry, initialPaidAmount, initialPaymentMethod]);

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
      if (defaultAccount && !selectedAccount) {
        setSelectedAccount(defaultAccount.id);
      } else if (data.length > 0 && !selectedAccount) {
        setSelectedAccount(data[0].id);
      }
    }
  }, [entry, toast, selectedAccount]);

  useEffect(() => {
    if (isOpen && entry) {
      fetchAccounts();
    }
  }, [isOpen, entry, fetchAccounts]);

  const handleRegisterPayment = async () => {
    setLoading(true);
    const parsedPaidAmount = parseCurrency(paidAmount);

    if (parsedPaidAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'O valor a pagar deve ser maior que zero.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (!paymentDate) {
      toast({ title: 'Data inválida', description: 'Por favor, selecione a data do pagamento.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (!selectedAccount) {
      toast({ title: 'Conta de Movimento', description: 'Por favor, selecione uma conta de movimento.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('register_payment', {
        p_credito_debito_id: entry.id,
        p_paid_amount: parsedPaidAmount,
        p_payment_date: paymentDate.toISOString().split('T')[0],
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

      clearSavedData();
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

  const handleDiscardChanges = () => {
    clearSavedData();
    setPaidAmount(initialPaidAmount ? String(initialPaidAmount).replace('.', ',') : String(entry.amount_balance || '0,00').replace('.', ','));
    setPaymentDate(new Date());
    setPaymentMethod(initialPaymentMethod || 'pix');
    setNotes('');
    setSelectedAccount(null);
    toast({ title: 'Alterações descartadas', description: 'Os dados não salvos foram removidos.' });
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Registrar Pagamento
            {hasAutoSaveData && (
              <span className="text-xs text-yellow-400">(Alterações não salvas)</span>
            )}
          </DialogTitle>
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
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl flex-1">
              Cancelar
            </Button>
            {hasAutoSaveData && (
              <Button
                type="button"
                onClick={handleDiscardChanges}
                variant="outline"
                className="rounded-xl flex-1 text-yellow-400 border-yellow-400 hover:bg-yellow-400/10"
              >
                Descartar Alterações
              </Button>
            )}
          </div>
          <Button
            onClick={handleRegisterPayment}
            disabled={loading || !selectedAccount}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-xl flex-1"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;