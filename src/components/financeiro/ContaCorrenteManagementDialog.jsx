import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, ToggleRight, ToggleLeft, Loader2, Banknote } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ContaCorrenteFormDialog } from './ContaCorrenteFormDialog';
import { formatCurrency, cn } from '@/lib/utils';
import { logAction } from '@/lib/logger'; // Import logAction

export const ContaCorrenteManagementDialog = ({ cnpjEmpresa, empresaNome, isOpen, onClose }) => {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const { toast } = useToast();

  const fetchContasCorrentes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conta_corrente')
      .select('*')
      .eq('cnpj_empresa', cnpjEmpresa)
      .order('banco', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao buscar contas correntes', description: error.message, variant: 'destructive' });
      await logAction('fetch_bank_accounts_failed', { error: error.message, cnpj_empresa: cnpjEmpresa });
      setContas([]);
    } else {
      setContas(data || []);
      await logAction('fetch_bank_accounts_success', { cnpj_empresa: cnpjEmpresa, count: data?.length });
    }
    setLoading(false);
  }, [cnpjEmpresa, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchContasCorrentes();
    }
  }, [isOpen, fetchContasCorrentes]);

  const handleNewConta = () => {
    setSelectedConta(null);
    setIsFormDialogOpen(true);
  };

  const handleEditConta = (conta) => {
    setSelectedConta(conta);
    setIsFormDialogOpen(true);
  };

  const handleToggleAtivo = async (conta) => {
    setTogglingId(conta.id);
    const novoStatus = !conta.ativo;
    const { error } = await supabase.from('conta_corrente').update({ ativo: novoStatus }).eq('id', conta.id);

    if (error) {
      toast({ title: 'Erro ao mudar status', description: error.message, variant: 'destructive' });
      await logAction('toggle_bank_account_failed', { error: error.message, account_id: conta.id, current_status: conta.ativo });
    } else {
      toast({ title: `Conta ${novoStatus ? 'ativada' : 'desativada'}!`, description: `A conta ${conta.banco} foi ${novoStatus ? 'ativada' : 'desativada'}.` });
      await logAction('toggle_bank_account_success', { account_id: conta.id, new_status: novoStatus });
      fetchContasCorrentes(); // Refresh the list
    }
    setTogglingId(null);
  };

  const handleSaveSuccess = () => {
    setIsFormDialogOpen(false);
    fetchContasCorrentes(); // Refresh the list after save
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="w-6 h-6 text-emerald-400" /> Gerenciar Contas Bancárias
          </DialogTitle>
          <DialogDescription className="text-emerald-300">
            Gerencie as contas correntes da empresa <span className="font-bold">{empresaNome}</span>.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Button onClick={handleNewConta} className="bg-emerald-600 hover:bg-emerald-700 text-white mb-4">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova Conta
          </Button>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/20">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-white/10 border-b-white/20">
                    <TableHead className="text-white">Banco</TableHead>
                    <TableHead className="text-white">Agência</TableHead>
                    <TableHead className="text-white">Conta</TableHead>
                    <TableHead className="text-white text-right">Saldo</TableHead>
                    <TableHead className="text-white text-center">Status</TableHead>
                    <TableHead className="text-white text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.length > 0 ? (
                    contas.map((conta) => (
                      <TableRow key={conta.id} className={cn("border-b-white/10 text-white/90 hover:bg-white/5", !conta.ativo && "opacity-50")}>
                        <TableCell data-label="Banco" className="font-medium">{conta.banco}</TableCell>
                        <TableCell data-label="Agência">{conta.agencia}</TableCell>
                        <TableCell data-label="Conta">{conta.conta}</TableCell>
                        <TableCell data-label="Saldo" className="text-right font-bold">{formatCurrency(conta.saldo)}</TableCell>
                        <TableCell data-label="Status" className="text-center">
                          <button 
                            onClick={() => handleToggleAtivo(conta)}
                            disabled={togglingId === conta.id}
                            className={cn(
                              "flex items-center gap-1 mx-auto px-2 py-1 rounded-full text-xs font-bold transition-colors",
                              conta.ativo ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                            )}
                          >
                            {togglingId === conta.id ? (
                               <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                               conta.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />
                            )}
                            {conta.ativo ? 'Ativa' : 'Inativa'}
                          </button>
                        </TableCell>
                        <TableCell className="text-right actions-cell">
                          <div className="flex justify-end items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditConta(conta)}
                              className="text-yellow-400 hover:text-yellow-300 rounded-xl"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-400 py-8">
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
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>

      {isFormDialogOpen && (
        <ContaCorrenteFormDialog
          cnpjEmpresa={cnpjEmpresa}
          isOpen={isFormDialogOpen}
          onClose={() => setIsFormDialogOpen(false)}
          onSaveSuccess={handleSaveSuccess}
          contaToEdit={selectedConta}
        />
      )}
    </Dialog>
  );
};