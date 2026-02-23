import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Save, Banknote } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, parseCurrency } from '@/lib/utils';
import { logAction } from '@/lib/logger'; // Import logAction

export const ContaCorrenteFormDialog = ({ cnpjEmpresa, isOpen, onClose, onSaveSuccess, contaToEdit }) => {
  const [formData, setFormData] = useState({
    banco: '',
    agencia: '',
    conta: '',
    saldo: '0,00',
    is_default: false,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEditing = !!contaToEdit;

  useEffect(() => {
    if (isEditing && contaToEdit) {
      setFormData({
        banco: contaToEdit.banco || '',
        agencia: contaToEdit.agencia || '',
        conta: contaToEdit.conta || '',
        saldo: String(contaToEdit.saldo || '0,00').replace('.', ','), // Format for input
        is_default: contaToEdit.is_default || false,
      });
    } else {
      setFormData({
        banco: '',
        agencia: '',
        conta: '',
        saldo: '0,00',
        is_default: false,
      });
    }
  }, [isEditing, contaToEdit]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleCurrencyChange = (value) => {
    setFormData((prev) => ({ ...prev, saldo: value }));
  };

  const handleCheckboxChange = (checked) => {
    setFormData((prev) => ({ ...prev, is_default: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const parsedSaldo = parseCurrency(formData.saldo);
    if (isNaN(parsedSaldo)) {
      toast({ title: 'Erro de validação', description: 'O saldo deve ser um número válido.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const dataToSave = {
      cnpj_empresa: cnpjEmpresa,
      banco: formData.banco,
      agencia: formData.agencia,
      conta: formData.conta,
      saldo: parsedSaldo,
      is_default: formData.is_default,
    };

    let error;
    let actionType = '';

    if (isEditing) {
      actionType = 'update_bank_account';
      const { error: updateError } = await supabase
        .from('conta_corrente')
        .update({ ...dataToSave, updated_at: new Date() })
        .eq('id', contaToEdit.id);
      error = updateError;
    } else {
      actionType = 'create_bank_account';
      const { error: insertError } = await supabase
        .from('conta_corrente')
        .insert(dataToSave);
      error = insertError;
    }

    if (error) {
      toast({ title: `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} conta`, description: error.message, variant: 'destructive' });
      await logAction(`${actionType}_failed`, { error: error.message, bank: formData.banco, account_number: formData.conta });
    } else {
      toast({ title: `Conta ${isEditing ? 'atualizada' : 'cadastrada'} com sucesso!` });
      await logAction(`${actionType}_success`, { account_id: contaToEdit?.id || 'new', bank: formData.banco, account_number: formData.conta });
      onSaveSuccess();
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-400" /> {isEditing ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
          </DialogTitle>
          <DialogDescription className="text-emerald-300">
            {isEditing ? 'Atualize os dados da conta corrente.' : 'Preencha os dados para adicionar uma nova conta corrente.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="banco">Banco</Label>
              <Input id="banco" value={formData.banco} onChange={handleChange} required className="bg-white/10 border-white/30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agencia">Agência</Label>
              <Input id="agencia" value={formData.agencia} onChange={handleChange} required className="bg-white/10 border-white/30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta">Conta</Label>
              <Input id="conta" value={formData.conta} onChange={handleChange} required className="bg-white/10 border-white/30" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="saldo">Saldo Inicial</Label>
              <Input
                id="saldo"
                value={formData.saldo}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                placeholder="0,00"
                className="bg-white/10 border-white/30"
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={handleCheckboxChange}
              className="border-white/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
            />
            <Label htmlFor="is_default" className="text-white">Definir como conta padrão</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};