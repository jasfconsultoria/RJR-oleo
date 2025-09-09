import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, Loader2, Search, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { logAction } from '@/lib/logger';

const ListaCentrosCusto = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [centrosCusto, setCentrosCusto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const fetchCentrosCusto = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('centro_custos')
      .select('id, codigo, nome, created_at')
      .order('nome', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao buscar centros de custo', description: error.message, variant: 'destructive' });
      setCentrosCusto([]);
    } else {
      setCentrosCusto(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCentrosCusto();
  }, [fetchCentrosCusto]);

  const handleDelete = async (id) => {
    setDeletingId(id);
    const { error } = await supabase.from('centro_custos').delete().eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir centro de custo', description: error.message, variant: 'destructive' });
      await logAction('delete_cost_center_failed', { error: error.message, cost_center_id: id });
    } else {
      toast({ title: 'Centro de custo excluído', description: 'O centro de custo foi removido com sucesso.', variant: 'success' });
      await logAction('delete_cost_center_success', { cost_center_id: id });
      fetchCentrosCusto(); // Refresh the list
    }
    setDeletingId(null);
  };

  const filteredCentrosCusto = centrosCusto.filter(centro =>
    centro.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>Centro de Custos - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Tag className="w-8 h-8 text-emerald-400" /> Centro de Custos
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie os centros de custo da empresa.</p>
          </div>
          <Button onClick={() => navigate('/app/centros-custo/novo')} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Centro de Custo
          </Button>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                placeholder="Buscar centro de custo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
            </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
            <div className="overflow-x-auto rounded-xl">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                </div>
              ) : (
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow className="border-white/20 hover:bg-transparent">
                      <TableHead className="text-emerald-300 w-[100px]">Código</TableHead>
                      <TableHead className="text-emerald-300">Nome</TableHead>
                      <TableHead className="text-emerald-300 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCentrosCusto.length > 0 ? (
                      filteredCentrosCusto.map((centro) => (
                        <TableRow key={centro.id} className="border-white/10 hover:bg-white/5">
                          <TableCell data-label="Código" className="font-mono">{centro.codigo}</TableCell>
                          <TableCell data-label="Nome" className="font-medium">{centro.nome}</TableCell>
                          <TableCell className="text-right actions-cell">
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/app/centros-custo/editar/${centro.id}`)}
                                className="text-yellow-400 hover:text-yellow-300 rounded-xl"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-400 hover:text-red-300 rounded-xl"
                                    disabled={deletingId === centro.id}
                                  >
                                    {deletingId === centro.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-emerald-300">
                                      Esta ação não pode ser desfeita. Isso excluirá permanentemente o centro de custo "{centro.nome}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(centro.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
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
                        <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                          Nenhum centro de custo encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
        </motion.div>
      </div>
    </>
  );
};

export default ListaCentrosCusto;