import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ContaCorrenteFormDialog } from './ContaCorrenteFormDialog';

export const ContaCorrenteManagementDialog = ({ cnpjEmpresa, empresaNome, isOpen, onClose }) => {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState(null);
  const { toast } = useToast();

  const fetchContas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conta_corrente')
      .select('*')
      .eq('cnpj_empresa', cnpjEmpresa)
      .order('banco', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao buscar contas', description: error.message, variant: 'destructive' });
      setContas([]);
    } else {
      setContas(data || []);
    }
    setLoading(false);
  }, [cnpjEmpresa, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchContas();
    }
  }, [isOpen, fetchContas]);

  const totalSaldo = useMemo(() => {
    return contas.reduce((sum, conta) => sum + (parseFloat(conta.saldo) || 0), 0);
  }, [contas]);

  const handleAddConta = () => {
    setSelectedConta(null);
    setIsFormDialogOpen(true);
  };

  const handleEditConta = (conta) => {
    setSelectedConta(conta);
    setIsFormDialogOpen(true);
  };

  const handleDeleteConta = async (contaId) => {
    setLoading(true);
    const { error } = await supabase.from('conta_corrente').delete().eq('id', contaId);

    if (error) {
      toast({ title: 'Erro ao excluir conta', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Conta excluída com sucesso!' });
      fetchContas();
    }
    setLoading(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-3xl">
          <DialogHeader>
            <DialogTitle>Contas Correntes de {empresaNome}</DialogTitle>
            <DialogDescription className="text-emerald-300">
              Gerencie as contas bancárias associadas a esta empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button onClick={handleAddConta} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Nova Conta
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
                    {contas.length > 0 ? (
                      contas.map(conta => (
                        <TableRow key={conta.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Banco" className="font-medium">{conta.banco}</TableCell>
                          <TableCell data-label="Agência">{conta.agencia}</TableCell>
                          <TableCell data-label="Conta">{conta.conta}</TableCell>
                          <TableCell data-label="Saldo" className="text-right">{formatCurrency(conta.saldo)}</TableCell>
                          <TableCell className="text-center actions-cell">
                            <div className="flex justify-center items-center gap-2">
                              <Button variant="ghost" size="icon" className="text-yellow-400 hover:text-yellow-300 rounded-xl" onClick={() => handleEditConta(conta)}>
                                <Edit className="h-4 w-4" />
                              </Button>
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
                                      Esta ação não pode ser desfeita. Isso excluirá permanentemente a conta "{conta.banco} - {conta.conta}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteConta(conta.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
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
            <div className="text-right text-lg font-bold text-white mt-4 pt-4 border-t border-white/20">
              Saldo Total: <span className="text-emerald-300">{formatCurrency(totalSaldo)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContaCorrenteFormDialog
        cnpjEmpresa={cnpjEmpresa}
        contaToEdit={selectedConta}
        isOpen={isFormDialogOpen}
        onClose={() => setIsFormDialogOpen(false)}
        onSaveSuccess={fetchContas}
      />
    </>
  );
};