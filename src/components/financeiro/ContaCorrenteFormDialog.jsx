import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { parseCurrency } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; // Importar Checkbox

export const ContaCorrenteFormDialog = ({ cnpjEmpresa, contaToEdit, isOpen, onClose, onSaveSuccess }) => {
  const [formData, setFormData] = useState({
    banco: '',
    agencia: '',
    conta: '',
    saldo: '0,00',
    is_default: false, // Novo campo
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isEditing = !!contaToEdit;

  useEffect(() => {
    if (isOpen) {
      if (contaToEdit) {
        setFormData({
          banco: contaToEdit.banco || '',
          agencia: contaToEdit.agencia || '',
          conta: contaToEdit.conta || '',
          saldo: String(contaToEdit.saldo || '0.00').replace('.', ','),
          is_default: contaToEdit.is_default || false, // Carregar valor existente
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
    }
  }, [isOpen, contaToEdit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaldoChange = (value) => {
    setFormData(prev => ({ ...prev, saldo: value }));
  };

  const handleCheckboxChange = (checked) => {
    setFormData(prev => ({ ...prev, is_default: checked }));
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
      banco: formData.banco.trim(),
      agencia: formData.agencia.trim(),
      conta: formData.conta.trim(),
      saldo: parsedSaldo,
      is_default: formData.is_default, // Incluir no objeto a ser salvo
    };

    let result;
    if (isEditing) {
      result = await supabase.from('conta_corrente').update(dataToSave).eq('id', contaToEdit.id).select().single();
    } else {
      result = await supabase.from('conta_corrente').insert(dataToSave).select().single();
    }

    if (result.error) {
      toast({ title: `Erro ao ${isEditing ? 'atualizar' : 'adicionar'} conta`, description: result.error.message, variant: 'destructive' });
    } else {
      toast({ title: `Conta ${isEditing ? 'atualizada' : 'adicionada'} com sucesso!` });
      onSaveSuccess();
      onClose();
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Conta Corrente' : 'Adicionar Nova Conta Corrente'}</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Preencha os detalhes da conta bancária.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <Input
              id="banco"
              name="banco"
              value={formData.banco}
              onChange={handleInputChange}
              required
              className="bg-white/10 border-white/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agencia">Agência</Label>
              <Input
                id="agencia"
                name="agencia"
                value={formData.agencia}
                onChange={handleInputChange}
                required
                className="bg-white/10 border-white/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conta">Conta</Label>
              <Input
                id="conta"
                name="conta"
                value={formData.conta}
                onChange={handleInputChange}
                required
                className="bg-white/10 border-white/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="saldo">Saldo (R$)</Label>
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
                  signed: true, // Allow negative for balance
                },
              }}
              value={formData.saldo}
              onAccept={handleSaldoChange}
              placeholder="0,00"
              className="w-full flex h-10 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={handleCheckboxChange}
              className="border-white/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
            />
            <Label htmlFor="is_default">Definir como Conta Padrão</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? 'Salvar Alterações' : 'Adicionar Conta')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};