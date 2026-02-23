import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Edit, Trash2, X, Save } from 'lucide-react';
import { formatCurrency, parseCurrency, formatToISODate } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { IMaskInput } from 'react-imask';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PaymentHistoryDialog = ({ isOpen, onClose, entry, onSuccess }) => {
  const { toast } = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const fetchPayments = useCallback(async () => {
    if (!entry) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('credito_debito_id', entry.id)
      .order('payment_date', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao buscar pagamentos', description: error.message, variant: 'destructive' });
      setPayments([]);
    } else {
      setPayments(data || []);
    }
    setLoading(false);
  }, [entry, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchPayments();
    }
  }, [isOpen, fetchPayments]);

  const handleEditClick = (payment) => {
    setEditingPaymentId(payment.id);
    setEditFormData({
      paid_amount: String(payment.paid_amount), // Garante que é string
      payment_date: payment.payment_date ? parseISO(payment.payment_date) : new Date(),
    });
  };

  const handleCancelEdit = () => {
    setEditingPaymentId(null);
    setEditFormData({});
  };

  const handleSaveEdit = async (paymentId) => {
    const newPaidAmount = parseCurrency(editFormData.paid_amount);
    const originalPayment = payments.find(p => p.id === paymentId);
    const limitValue = entry.installment_value || entry.total_value;
    if (newPaidAmount + otherPaymentsTotal > limitValue + 0.01) {
      toast({
        title: 'Valor excede o total da parcela',
        description: `O valor total pago não pode exceder ${formatCurrency(limitValue)}.`,
        variant: 'destructive',
      });
      return;
    }

    const { data, error } = await supabase.rpc('update_payment', {
      payment_id: paymentId,
      new_amount: newPaidAmount,
      new_date: formatToISODate(editFormData.payment_date),
    });

    if (error || (data && !data.success)) {
      toast({ title: 'Erro ao atualizar pagamento', description: error?.message || data?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Pagamento atualizado com sucesso!' });
      handleCancelEdit();
      fetchPayments();
      onSuccess(); // Refresh the main list
    }
  };

  const handleDelete = async (paymentId) => {
    try {
      const { data, error } = await supabase.rpc('delete_payment', { p_payment_id: paymentId });

      if (error) {
        throw new Error(error.message || 'Erro ao excluir pagamento');
      }

      if (data && !data.success) {
        throw new Error(data.message || 'Erro ao excluir pagamento');
      }

      toast({ title: 'Pagamento excluído com sucesso!' });
      fetchPayments();
      onSuccess(); // Refresh the main list
    } catch (error) {
      console.error('Erro ao excluir pagamento:', error);
      toast({
        title: 'Erro ao excluir pagamento',
        description: error.message || 'Ocorreu um erro desconhecido.',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de Pagamentos</DialogTitle>
          <DialogDescription className="text-emerald-300">
            {entry?.description} - Parcela {entry?.installment_number}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-white/20">
                  <TableHead className="text-white">Data</TableHead>
                  <TableHead className="text-white text-right">Valor Pago</TableHead>
                  <TableHead className="text-white text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length > 0 ? payments.map(payment => (
                  editingPaymentId === payment.id ? (
                    <TableRow key={payment.id} className="bg-white/10">
                      <TableCell>
                        <Input type="date" value={format(editFormData.payment_date, 'yyyy-MM-dd')} onChange={(e) => setEditFormData({ ...editFormData, payment_date: parseISO(e.target.value) })} className="bg-white/20 border-white/30" />
                      </TableCell>
                      <TableCell className="text-right">
                        <IMaskInput
                          mask="num"
                          blocks={{ num: { mask: Number, scale: 2, thousandsSeparator: '.', padFractionalZeros: true, radix: ',', mapToRadix: ['.'] } }}
                          value={editFormData.paid_amount}
                          lazy={false}
                          onAccept={(value) => setEditFormData({ ...editFormData, paid_amount: value })}
                          placeholder="0,00"
                          className="w-32 !text-right bg-white/20 border-white/30 h-10 px-3 py-2 rounded-md text-sm"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleSaveEdit(payment.id)} className="text-green-400 hover:text-green-300"><Save className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="text-red-400 hover:text-red-300"><X className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={payment.id} className="border-b-white/10">
                      <TableCell>{format(parseISO(payment.payment_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.paid_amount)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="icon" variant="ghost" onClick={() => handleEditClick(payment)} className="text-yellow-400 hover:text-yellow-300"><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription className="text-emerald-300">Tem certeza que deseja excluir este pagamento de {formatCurrency(payment.paid_amount)}?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )) : (
                  <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-8">Nenhum pagamento registrado para esta parcela.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentHistoryDialog;