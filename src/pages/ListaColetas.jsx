import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import ColetasFilters from '@/components/coletas/ColetasFilters';
import ColetasTable from '@/components/coletas/ColetasTable';
import { startOfMonth, format, endOfDay, parseISO, endOfMonth, subDays } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { ReciboViewDialog } from '@/components/coletas/ReciboViewDialog';

const ListaColetas = () => {
  const [coletas, setColetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: subDays(new Date(), 30), // Default to last 30 days
    endDate: new Date(), // Default to today
    clienteId: null,
    numeroColetaTerm: '',
    clienteNameTerm: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'data_coleta', direction: 'desc' });
  const { profile, loading: profileLoading } = useProfile();
  const [clients, setClients] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isReciboDialogOpen, setIsReciboDialogOpen] = useState(false);
  const [selectedColetaForRecibo, setSelectedColetaForRecibo] = useState(null);

  const debouncedFilters = useDebounce(filters, 500);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!profile) return;
      try {
        const [clientDataRes, empresaDataRes] = await Promise.all([
          supabase.from('clientes').select('id, nome, nome_fantasia').order('nome', { ascending: true }),
          supabase.from('empresa').select('*').single(),
        ]);

        if (clientDataRes.error) throw clientDataRes.error;
        setClients(clientDataRes.data || []);

        if (empresaDataRes.error) throw empresaDataRes.error;
        setEmpresa(empresaDataRes.data);
      } catch (error) {
        toast({ title: 'Erro ao carregar dados da página', description: error.message, variant: 'destructive' });
      }
    };
    if (!profileLoading) {
      fetchInitialData();
    }
  }, [profile, profileLoading, toast]);

  const fetchColetas = useCallback(async () => {
    if (!empresa || !debouncedFilters.startDate || !debouncedFilters.endDate) return;
    
    setLoading(true);
    
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const startDate = new Date(debouncedFilters.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(debouncedFilters.endDate);
    endDate.setHours(23, 59, 59, 999);

    let query = supabase
      .from('v_coletas_com_status')
      .select('*', { count: 'exact' })
      .gte('data_coleta', startDate.toISOString())
      .lte('data_coleta', endDate.toISOString());

    if (debouncedFilters.clienteId) {
      query = query.eq('cliente_id', debouncedFilters.clienteId);
    }
    if (debouncedFilters.numeroColetaTerm) {
      query = query.ilike('numero_coleta', `%${debouncedFilters.numeroColetaTerm}%`);
    }
    if (debouncedFilters.clienteNameTerm) {
      query = query.or(`cliente_nome.ilike.%${debouncedFilters.clienteNameTerm}%,cliente_nome_fantasia.ilike.%${debouncedFilters.clienteNameTerm}%`);
    }

    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar coletas', description: error.message, variant: 'destructive' });
      setColetas([]);
    } else {
      setColetas(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [empresa, currentPage, pageSize, debouncedFilters, sortConfig, toast]);

  useEffect(() => {
    if (empresa) {
        fetchColetas();
    }
  }, [fetchColetas, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters, pageSize]);

  const handleDelete = async (coletaId, numeroColeta) => {
    const { error } = await supabase.from('coletas').delete().eq('id', coletaId);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      await logAction('delete_coleta_failed', { error: error.message, coleta_id: coletaId });
    } else {
      toast({ title: 'Coleta excluída!', description: `A coleta Nº ${numeroColeta} foi removida com sucesso.` });
      await logAction('delete_coleta_success', { coleta_id: coletaId, numero_coleta: numeroColeta });
      fetchColetas();
    }
  };

  const handleOpenRecibo = (coleta) => {
    setSelectedColetaForRecibo(coleta);
    setIsReciboDialogOpen(true);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: subDays(new Date(), 30),
      endDate: new Date(),
      clienteId: null,
      numeroColetaTerm: '',
      clienteNameTerm: '',
    });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (profileLoading || loading || !empresa) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Lista de Coletas - Sistema RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <FileText className="w-8 h-8 text-emerald-400" /> Lista de Coletas
            </h1>
            <p className="text-emerald-200/80 mt-1">Visualize e gerencie todas as coletas realizadas.</p>
          </div>
          <Link to="/app/coletas/nova">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova Coleta
            </Button>
          </Link>
        </motion.div>

        <ColetasFilters 
          clients={clients}
          filters={filters}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
        />

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl relative z-10">
          <ColetasTable 
            coletas={coletas}
            loading={loading}
            sortConfig={sortConfig}
            requestSort={requestSort}
            handleDelete={handleDelete}
            handleOpenRecibo={handleOpenRecibo}
            timezone={empresa?.timezone}
          />
        </motion.div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </div>

      {selectedColetaForRecibo && (
        <ReciboViewDialog
          coleta={selectedColetaForRecibo}
          empresa={empresa}
          isOpen={isReciboDialogOpen}
          onClose={() => setIsReciboDialogOpen(false)}
          empresaTimezone={empresa?.timezone}
        />
      )}
    </>
  );
};

export default ListaColetas;