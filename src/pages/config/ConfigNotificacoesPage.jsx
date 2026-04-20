import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, Trash2, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ConfigNotificacoesPage = () => {
  const [notificacoes, setNotificacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchNotificacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notificacoes')
      .select('*') // Note: Removido o join direto com auth.users 
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      toast({ title: 'Erro ao buscar notificações', description: error.message, variant: 'destructive' });
    } else {
      setNotificacoes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotificacoes();
  }, []);

  const handleClearAll = async () => {
    if (!window.confirm('Tem certeza que deseja limpar TODAS as notificações de TODOS os usuários?')) return;
    
    // Deleta os registros diretamente
    const { error } = await supabase
      .from('notificacoes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to allow delete all based on policies

    if (error) {
      toast({ title: 'Erro ao limpar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Notificações limpas com sucesso!' });
      fetchNotificacoes();
    }
  };

  return (
    <>
      <Helmet><title>Painel de Notificações - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-emerald-400" /> Painel de Notificações
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie e audite os alertas emitidos pelo sistema logados no banco.</p>
          </div>
          <Button onClick={handleClearAll} variant="destructive" className="w-full sm:w-auto rounded-xl bg-red-600/80 hover:bg-red-700">
            <Trash2 className="mr-2 h-4 w-4" /> Limpar Histórico do Banco
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <th className="p-2 text-left text-white">Data</th>
                    <th className="p-2 text-left text-white">Tipo</th>
                    <th className="p-2 text-left text-white">Usuário Afetado</th>
                    <th className="p-2 text-left text-white">Título</th>
                    <th className="p-2 text-left text-white">Mensagem</th>
                    <th className="p-2 text-center text-white">Status</th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificacoes.length > 0 ? (
                    notificacoes.map(notif => (
                      <TableRow key={notif.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                        <TableCell data-label="Data">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                        </TableCell>
                        <TableCell data-label="Tipo" className="uppercase text-xs font-semibold text-emerald-300">
                          {notif.tipo}
                        </TableCell>
                        <TableCell data-label="Usuário Afetado">
                          <span className="text-xs text-blue-200 bg-blue-900/40 px-2 py-0.5 rounded-md break-all">
                             {notif.user_id ? notif.user_id : 'SISTEMA/TODOS'}
                          </span>
                        </TableCell>
                        <TableCell data-label="Título">{notif.titulo}</TableCell>
                        <TableCell data-label="Mensagem" className="max-w-xs truncate" title={notif.mensagem}>{notif.mensagem}</TableCell>
                        <TableCell data-label="Status" className="text-center">
                           {notif.is_read ? (
                              <span className="text-xs text-gray-400">Lida</span>
                           ): (
                              <span className="text-xs text-green-400 font-bold">Pendente</span>
                           )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan="6" className="text-center text-gray-400 py-10">
                        Nenhuma notificação registrada no banco.
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

export default ConfigNotificacoesPage;
