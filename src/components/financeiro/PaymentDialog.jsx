import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarIcon, Banknote } from 'lucide-react'; // Adicionado Banknote icon
import { formatCurrency, parseCurrency, formatToISODate } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { IMaskInput } from 'react-imask';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const paymentMethods = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'bank_transfer', label: 'Transferência Bancária' },
  { value: 'other', label: 'Outro' },
];

const PaymentDialog = ({ isOpen, onClose, entry, onSuccess }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [paymentData, setPaymentData] = useState({
    paid_amount: '',
    payment_date: new Date(),
    payment_method: entry?.payment_method || 'pix',
    notes: '',
    conta_corrente_id: '', // Novo estado para a conta corrente selecionada
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState([]); // Estado para as contas vinculadas
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // Calcula o saldo restante real da parcela
  const realRemainingBalance = entry ? (entry.total_value - (entry.paid_amount || 0)) : 0;
  
  // Calcula o novo total pago e o novo saldo com base no input do usuário
  const currentPaidAmountInput = parseCurrency(paymentData.paid_amount);
  const newTotalPaidDisplay = (entry?.paid_amount || 0) + currentPaidAmountInput;
  const newBalanceDisplay = realRemainingBalance - currentPaidAmountInput;

  // Função para buscar as contas correntes vinculadas ao usuário
  const fetchLinkedAccounts = useCallback(async () => {
    if (!user?.id) {
      setLinkedAccounts([]);
      setLoadingAccounts(false);
      return;
    }
    setLoadingAccounts(true);
    try {
      // Busca os IDs das contas vinculadas ao usuário
      const { data: links, error: linksError } = await supabase
        .from('conta_usuario')
        .select('conta_corrente_id')
        .eq('user_id', user.id);

      if (linksError) throw linksError;

      const accountIds = links.map(link => link.conta_corrente_id);

      if (accountIds.length > 0) {
        // Busca os detalhes completos das contas
        const { data: accounts, error: accountsError } = await supabase
          .from('conta_corrente')
          .select('*')
          .in('id', accountIds)
          .order('banco', { ascending: true });

        if (accountsError) throw accountsError;
        setLinkedAccounts(accounts || []);
        // Define a primeira conta como padrão, se houver
        if (accounts.length > 0 && !paymentData.conta_corrente_id) {
          setPaymentData(prev => ({ ...prev, conta_corrente_id: accounts[0].id }));
        }
      } else {
        setLinkedAccounts([]);
      }
    } catch (error) {
      toast({ title: 'Erro ao buscar contas vinculadas', description: error.message, variant: 'destructive' });
      setLinkedAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  }, [user, toast, paymentData.conta_corrente_id]);

  useEffect(() => {
    if (isOpen) {
      fetchLinkedAccounts();
      // Resetar o valor a pagar para 0,00 ao abrir o modal
      setPaymentData(prev => ({ 
        ...prev, 
        paid_amount: '0,00', // Alterado para '0,00'
        payment_date: new Date(), // Resetar data para hoje
        notes: '', // Limpar notas
      }));
    }
  }, [isOpen, fetchLinkedAccounts, realRemainingBalance]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleAmountChange = (value) => {
    setPaymentData(prev => ({ ...prev, paid_amount: value }));
  };

  const handleAccountSelectChange = (value) => {
    setPaymentData(prev => ({ ...prev, conta_corrente_id: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedPaidAmount = parseCurrency(paymentData.paid_amount);

    if (parsedPaidAmount <= 0) {
      toast({ title: 'Valor inválido', description: 'O valor do pagamento deve ser maior que zero.', variant: 'destructive' });
      return;
    }
    // A validação agora usa o saldo restante real
    if (parsedPaidAmount > realRemainingBalance + 0.01) { // Adiciona uma pequena tolerância para problemas de ponto flutuante
      toast({ title: 'Valor excede o saldo', description: `O valor máximo para pagamento é ${formatCurrency(realRemainingBalance)}.`, variant: 'destructive' });
      return;
    }
    if (!paymentData.conta_corrente_id) {
      toast({ title: 'Conta de Movimento Obrigatória', description: 'Por favor, selecione uma conta para registrar o pagamento.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    const rpc_params = {
      p_credito_debito_id: entry.id,
      p_paid_amount: parsedPaidAmount,
      p_payment_date: formatToISODate(paymentData.payment_date),
      p_payment_method: paymentData.payment_method,
      p_notes: paymentData.notes,
      p_conta_corrente_id: paymentData.conta_corrente_id, // Novo parâmetro
    };

    const { data, error } = await supabase.rpc('register_payment', rpc_params);

    if (error || (data && !data.success)) {
      const errorMessage = error?.message || data?.message || 'Ocorreu um erro desconhecido.';
      toast({ title: 'Erro ao registrar pagamento', description: `Detalhes: ${errorMessage}`, variant: 'destructive' });
    } else {
      onSuccess();
      onClose();
      toast({ title: 'Pagamento registrado com sucesso!' });
    }
    setIsSubmitting(false);
  };

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Para: {entry.cliente_fornecedor_name} - {entry.description}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-emerald-300">Valor da Parcela:</span> {formatCurrency(entry.total_value)}</div>
            <div><span className="text-emerald-300">Valor Pago:</span> {formatCurrency(newTotalPaidDisplay)}</div>
            <div className="col-span-2 font-bold text-lg"><span className="text-emerald-300">Saldo Devedor:</span> {formatCurrency(newBalanceDisplay)}</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-white/20">
          <div>
            <Label htmlFor="payment_method">Forma de Pagamento</Label>
            <Select value={paymentData.payment_method} onValueChange={(value) => setPaymentData(p => ({...p, payment_method: value}))}>
              <SelectTrigger className="bg-white/10 border-white/30">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-gray-700">
                {paymentMethods.map(method => (
                  <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="conta_movimento" className="flex items-center gap-2">
              <Banknote className="w-4 h-4" /> Conta Movimento *
            </Label>
            {loadingAccounts ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando contas...
              </div>
            ) : linkedAccounts.length > 0 ? (
              <Select value={paymentData.conta_corrente_id} onValueChange={handleAccountSelectChange}>
                <SelectTrigger className="bg-white/10 border-white/30">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700">
                  {linkedAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.banco} - Ag: {account.agencia} - Cta: {account.conta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-yellow-400 text-sm">Nenhuma conta corrente vinculada ao seu usuário. Contate o administrador.</p>
            )}
          </div>
          <div>
            <Label htmlFor="paid_amount">Valor a Pagar (R$)</Label>
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
                value={paymentData.paid_amount}
                onAccept={handleAmountChange}
                placeholder="0,00"
                className="w-full flex h-10 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm"
                required
            />
          </div>
          <div>
            <Label htmlFor="payment_date">Data do Pagamento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-white/10 border-white/30", !paymentData.payment_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {paymentData.payment_date ? format(paymentData.payment_date, 'dd/MM/yyyy') : <span>Selecione a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-gray-800 text-white border-gray-700">
                <Calendar mode="single" selected={paymentData.payment_date} onSelect={(date) => setPaymentData(p => ({...p, payment_date: date}))} initialFocus locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              name="notes"
              value={paymentData.notes}
              onChange={handleInputChange}
              placeholder="Adicione uma observação sobre o pagamento..."
              className="bg-white/10 border-white/30"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Registrar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentDialog;