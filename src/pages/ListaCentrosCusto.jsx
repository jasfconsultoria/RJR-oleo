import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit, Trash2, Loader2, Search } from 'lucide-react';
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
        <title>Centros de Custo - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto p-4"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-emerald-300">
              <PlusCircle className="w-8 h-8" />
              Centros de Custo
            </CardTitle>
            <Button onClick={() => navigate('/app/centros-custo/novo')} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
              <PlusCircle className="w-5 h-5 mr-2" />
              Novo Centro de Custo
            </Button>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
              <Input
                placeholder="Buscar centro de custo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
              />
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/20">
                      <TableHead className="text-emerald-300 w-[100px]">Código</TableHead>
                      <TableHead className="text-emerald-300">Nome</TableHead>
                      <TableHead className="text-emerald-300 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCentrosCusto.length > 0 ? (
                      filteredCentrosCusto.map((centro) => (
                        <TableRow key={centro.id} className="border-white/10 hover:bg-white/5">
                          <TableCell className="font-mono">{centro.codigo}</TableCell>
                          <TableCell className="font-medium">{centro.nome}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/app/centros-custo/editar/${centro.id}`)}
                              className="text-emerald-400 hover:bg-emerald-900"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-400 hover:bg-red-900"
                                  disabled={deletingId === centro.id}
                                >
                                  {deletingId === centro.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-gray-300">
                                    Esta ação não pode ser desfeita. Isso excluirá permanentemente o centro de custo "{centro.nome}".
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-gray-600 text-white hover:bg-gray-700 border-none rounded-xl">Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(centro.id)} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default ListaCentrosCusto;