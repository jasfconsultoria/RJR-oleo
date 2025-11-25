import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BookText, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/ui/pagination';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { toast } = useToast();

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ title: "Erro ao buscar configurações da empresa.", variant: "destructive" });
      }
      setEmpresa(data || { items_per_page: 25 });
    };
    fetchEmpresaData();
  }, [toast]);

  const fetchLogs = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (debouncedSearchTerm) {
      query = query.or(`action.ilike.%${debouncedSearchTerm}%,user_email.ilike.%${debouncedSearchTerm}%`);
    }

    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao buscar logs', description: error.message, variant: 'destructive' });
      setLogs([]);
    } else {
      setLogs(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [toast, debouncedSearchTerm, currentPage, pageSize, empresa]);

  useEffect(() => {
    if (empresa) {
        fetchLogs();
    }
  }, [fetchLogs, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, pageSize]);

  const renderDetails = (details) => {
    if (!details) return 'N/A';
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet>
        <title>Logs do Sistema - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <BookText className="w-8 h-8 text-emerald-400" /> Logs do Sistema
          </h1>
          <p className="text-emerald-200/80 mt-1">Visualize as atividades dos usuários no sistema.</p>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              type="search"
              placeholder="Buscar por ação ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
            />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-lg">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-white/10 border-b-white/20 text-xs">
                  <th className="p-2 text-left text-white">Data</th>
                  <th className="p-2 text-left text-white">Usuário</th>
                  <th className="p-2 text-left text-white">Ação</th>
                  <th className="p-2 text-left text-white">Detalhes</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading || !empresa ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-400" /></TableCell></TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id} className="border-b-0 md:border-b border-white/10 text-white/90">
                    <TableCell data-label="Data">{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</TableCell>
                    <TableCell data-label="Usuário">{log.user_email}</TableCell>
                    <TableCell data-label="Ação">{log.action}</TableCell>
                    <TableCell data-label="Detalhes" className="text-xs">{renderDetails(log.details)}</TableCell>
                  </TableRow>
                ))}
                {!loading && logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-16 text-gray-400">
                      Nenhum log encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </motion.div>
        
        {totalCount > 0 && (
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
            />
        )}

      </div>
    </>
  );
};

export default LogsPage;