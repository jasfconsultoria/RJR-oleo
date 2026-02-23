import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

export const ChangePasswordDialog = ({ user, isOpen, setIsOpen }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', description: 'Por favor, verifique os campos e tente novamente.', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke('change-password', {
      body: { userId: user.id, password },
    });

    if (error) {
      toast({ title: 'Erro ao alterar senha', description: error.message || 'User not allowed', variant: 'destructive' });
    } else {
      toast({ title: 'Senha alterada com sucesso!' });
      setIsOpen(false);
      setPassword('');
      setConfirmPassword('');
    }
    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white">
        <DialogHeader>
          <DialogTitle>Alterar Senha</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Digite a nova senha para o usuário <span className="font-bold">{user?.full_name}</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new_password">Nova Senha</Label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-white/10 border-white/30"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirmar Nova Senha</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="bg-white/10 border-white/30"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Alterar Senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};