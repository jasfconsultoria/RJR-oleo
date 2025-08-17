import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

const initialPermissions = {
  clientes: { view: false, edit: false, delete: false },
  coletas: { view: false, edit: false, delete: false },
  certificados: { view: false, edit: false, delete: false },
  relatorios: { view: false, edit: false, delete: false },
};

export const UserPermissionsModal = ({ user, isOpen, setIsOpen, onSave }) => {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setLoading(true);
      supabase.rpc('get_user_permissions', { p_user_id: user.id })
        .then(({ data, error }) => {
          if (error) {
            toast({ title: "Erro ao buscar permissões", description: error.message, variant: "destructive" });
          } else if (data) {
            setPermissions(data);
          } else {
            setPermissions(initialPermissions);
          }
          setLoading(false);
        });
    }
  }, [user, toast]);

  const handleCheckboxChange = (module, permission) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [permission]: !prev[module][permission]
      }
    }));
  };
  
  const handleSavePermissions = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('user_permissions')
      .upsert({ user_id: user.id, permissions: permissions }, { onConflict: 'user_id' });

    if (error) {
      toast({ title: 'Erro ao salvar permissões', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Permissões salvas com sucesso!' });
      onSave();
    }
    setLoading(false);
  };

  const modules = Object.keys(initialPermissions);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-emerald-900 border-emerald-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissões para {user?.full_name}</DialogTitle>
          <DialogDescription className="text-emerald-300">
            Defina o que este usuário pode visualizar, editar ou excluir no sistema.
          </DialogDescription>
        </DialogHeader>
        {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400 my-8" /> : (
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-white/10 border-b-white/20">
                  <TableHead className="text-white">Módulo</TableHead>
                  <TableHead className="text-white text-center">Visualizar</TableHead>
                  <TableHead className="text-white text-center">Editar</TableHead>
                  <TableHead className="text-white text-center">Excluir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map(module => (
                  <TableRow key={module} className="border-b-white/10 text-white/90">
                    <TableCell className="font-medium capitalize">{module}</TableCell>
                    {Object.keys(permissions[module]).map(permission => (
                      <TableCell key={permission} className="text-center">
                        <Checkbox
                          checked={permissions[module][permission]}
                          onCheckedChange={() => handleCheckboxChange(module, permission)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
          <Button onClick={handleSavePermissions} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};