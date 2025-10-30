import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { AccountSelectionDialog } from '@/components/financeiro/AccountSelectionDialog';

export const UserAccountLinkModal = ({ user, isOpen, setIsOpen }) => {
  const { toast } = useToast();
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

  const fetchLinkedAccounts = useCallback(async () => {
    if (!user?.id) {
      setLinkedAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Fetch links from conta_usuario
      const { data: links, error: linksError } = await supabase
        .from('conta_usuario')
        .select('conta_corrente_id')
        .eq('user_id', user.id);

      if (linksError) throw linksError;

      const accountIds = links.map(link => link.conta_corrente_id);

      if (accountIds.length > 0) {
        // Fetch full account details for linked accounts
        const { data: accounts, error: accountsError } = await supabase
          .from('conta_corrente')
          .select('*')
          .in('id', accountIds)
          .order('banco', { ascending: true });

        if (accountsError) throw accountsError;
        setLinkedAccounts(accounts || []);
      } else {
        setLinkedAccounts([]);
      }
    } catch (error) {
      toast({ title: 'Erro ao buscar contas vinculadas', description: error.message, variant: 'destructive' });
      setLinkedAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchLinkedAccounts();
    }
  }, [isOpen, fetchLinkedAccounts]);

  const handleUnlinkAccount = async (accountId, accountName) => {
    setLoading(true);
    const { error } = await supabase
      .from('conta_usuario')
      .delete()
      .eq('user_id', user.id)
      .eq('conta_corrente_id', accountId);

    if (error) {
      toast({ title: 'Erro ao desvincular conta', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Conta desvinculada com sucesso!', description: `A conta ${accountName} foi desvinculada.` });
      fetchLinkedAccounts(); // Refresh the list
    }
    setLoading(false);
  };

  const handleOpenSelectionDialog = () => {
    setIsSelectionDialogOpen(true);
  };

  const handleSelectionSuccess = () => {
    fetchLinkedAccounts(); // Refresh linked accounts after selection
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Contas Vinculadas a {user?.full_name || user?.email}</DialogTitle>
            <DialogDescription className="text-emerald-300">
              Gerencie as contas correntes que este usuário pode acessar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button onClick={handleOpenSelectionDialog} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar/Remover Contas
            </Button>

            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/20">
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                      <TableHead className="text-white">Banco</TableHead>
                      <TableHead className="text-white">Agência</TableHead>
                      <TableHead className="text-white">Conta</TableHead>
                      <TableHead className="text-white text-right">Saldo</TableHead>
                      <TableHead className="text-white text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedAccounts.length > 0 ? (
                      linkedAccounts.map(conta => (
                        <TableRow key={conta.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Banco" className="font-medium">{conta.banco}</TableCell>
                          <TableCell data-label="Agência">{conta.agencia}</TableCell>
                          <TableCell data-label="Conta">{conta.conta}</TableCell>
                          <TableCell data-label="Saldo" className="text-right">{formatCurrency(conta.saldo)}</TableCell>
                          <TableCell className="text-center actions-cell">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 rounded-xl">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-emerald-300">
                                    Esta ação desvinculará a conta "{conta.banco} - {conta.conta}" do usuário.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleUnlinkAccount(conta.id, `${conta.banco} - ${conta.conta}`)} className="bg-red-500 hover:bg-red-600 rounded-xl">
                                    Desvincular
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-400 py-8">
                          Nenhuma conta vinculada a este usuário.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isSelectionDialogOpen && (
        <AccountSelectionDialog
          isOpen={isSelectionDialogOpen}
          onClose={() => setIsSelectionDialogOpen(false)}
          userId={user?.id}
          onLinkSuccess={handleSelectionSuccess}
          linkedAccountIds={linkedAccounts.map(acc => acc.id)}
        />
      )}
    </>
  );
};