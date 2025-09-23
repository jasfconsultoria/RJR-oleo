import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/utils';

export const AccountSelectionDialog = ({ isOpen, onClose, userId, onLinkSuccess, linkedAccountIds = [] }) => {
  const { toast } = useToast();
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccounts, setSelectedAccounts] = useState(new Set(linkedAccountIds));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAvailableAccounts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conta_corrente')
      .select('*')
      .order('banco', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao buscar contas correntes', description: error.message, variant: 'destructive' });
      setAvailableAccounts([]);
    } else {
      setAvailableAccounts(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableAccounts();
      setSelectedAccounts(new Set(linkedAccountIds)); // Reset selected accounts on open
    }
  }, [isOpen, fetchAvailableAccounts, linkedAccountIds]);

  const handleCheckboxChange = (accountId, checked) => {
    setSelectedAccounts(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(accountId);
      } else {
        newSet.delete(accountId);
      }
      return newSet;
    });
  };

  const handleLinkAccounts = async () => {
    setIsSubmitting(true);
    const accountsToLink = Array.from(selectedAccounts);
    
    // Determine which accounts to add and which to remove
    const currentLinked = new Set(linkedAccountIds);
    const toAdd = accountsToLink.filter(id => !currentLinked.has(id));
    const toRemove = linkedAccountIds.filter(id => !selectedAccounts.has(id));

    let hasError = false;

    // Add new links
    for (const accountId of toAdd) {
      const { error } = await supabase
        .from('conta_usuario')
        .insert({ user_id: userId, conta_corrente_id: accountId });
      if (error) {
        toast({ title: 'Erro ao vincular conta', description: error.message, variant: 'destructive' });
        hasError = true;
      }
    }

    // Remove old links
    for (const accountId of toRemove) {
      const { error } = await supabase
        .from('conta_usuario')
        .delete()
        .eq('user_id', userId)
        .eq('conta_corrente_id', accountId);
      if (error) {
        toast({ title: 'Erro ao desvincular conta', description: error.message, variant: 'destructive' });
        hasError = true;
      }
    }

    if (!hasError) {
      toast({ title: 'Contas vinculadas com sucesso!' });
      onLinkSuccess();
      onClose();
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle>Selecionar Contas Correntes</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Selecione as contas que deseja vincular a este usuário.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/20">
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <TableHead className="text-white w-[50px] text-center">Selecionar</TableHead>
                    <TableHead className="text-white">Banco</TableHead>
                    <TableHead className="text-white">Agência</TableHead>
                    <TableHead className="text-white">Conta</TableHead>
                    <TableHead className="text-white text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableAccounts.length > 0 ? (
                    availableAccounts.map(conta => (
                      <TableRow key={conta.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedAccounts.has(conta.id)}
                            onCheckedChange={(checked) => handleCheckboxChange(conta.id, checked)}
                          />
                        </TableCell>
                        <TableCell data-label="Banco" className="font-medium">{conta.banco}</TableCell>
                        <TableCell data-label="Agência">{conta.agencia}</TableCell>
                        <TableCell data-label="Conta">{conta.conta}</TableCell>
                        <TableCell data-label="Saldo" className="text-right">{formatCurrency(conta.saldo)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                        Nenhuma conta corrente cadastrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting} onClick={handleLinkAccounts}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Vincular Contas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};