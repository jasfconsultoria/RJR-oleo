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
import { startOfMonth, format, endOfDay, parseISO } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { ReciboViewDialog } from '@/components/coletas/ReciboViewDialog';

const ListaColetas = () => {
  const [coletas, setColetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [coletaSearchTerm, setColetaSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState(''); // Novo estado para busca de cliente
  
  const [sortConfig, setSortConfig] = useState({ key: 'numero_coleta', direction: 'desc' });
  const { profile, loading: profileLoading } = useProfile();
  
  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [selectedColeta, setSelectedColeta] = useState(null);
  const [empresa, setEmpresa] = useState(null);

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [periodTotals, setPeriodTotals] = useState({ coletado: 0, compras: 0, entregue: 0 });

  const debouncedColetaSearchTerm = useDebounce(coletaSearchTerm, 500);
  const debouncedClientSearchTerm = useDebounce(clientSearchTerm, 500); // Debounce para busca de cliente
  const debouncedStartDate = useDebounce(startDate, 500);
  const debouncedEndDate = useDebounce(endDate, 500);
  const { toast } = useToast();

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data, error } = await supabase.from('empresa').select('*').single();
      if (error) {
        console.error("Erro ao buscar dados da empresa:", error);
        toast({ title: "Erro ao buscar configurações da empresa.", variant: "destructive" });
      }
      setEmpresa(data || { items_per_page: 25, timezone: 'America/Sao_Paulo' });
    };
    fetchEmpresaData();
  }, [toast]);

  const fetchPeriodTotals = useCallback(async () => {
    if (profileLoading || !profile || !empresa) return;

    let query = supabase.rpc('get_coletas_totals', {
        p_start_date: debouncedColetaSearchTerm ? null : (debouncedStartDate || null),
        p_end_date: debouncedColetaSearchTerm ? null : (debouncedEndDate || null),
        p_cliente_id: null, // Removido filtro por ID
        p_numero_coleta_term: debouncedColetaSearchTerm || null,
        p_cliente_name_term: debouncedClientSearchTerm || null, // Novo parâmetro para busca por nome do cliente
    });

    const { data, error } = await query.single();

    if (error) {
      console.error("Erro ao buscar totais do período:", error);
      setPeriodTotals({ coletado: 0, compras: 0, entregue: 0 });
    } else {
      setPeriodTotals({
        coletado: data.total_coletado || 0,
        compras: data.total_compras || 0,
        entregue: data.total_entregue || 0,
      });
    }
  }, [profile, profileLoading, empresa, debouncedStartDate, debouncedEndDate, debouncedColetaSearchTerm, debouncedClientSearchTerm]);

  const fetchColetas = useCallback(async () => {
    if (profileLoading || !profile || !empresa) return;
    setLoading(true);

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase.from('v_coletas_com_status').select('*', { count: 'exact' }); // Use a nova view

    if (debouncedColetaSearchTerm) {
        // Aplica a busca diretamente na view
        query = query.or(`numero_coleta::text.ilike.%${debouncedColetaSearchTerm}%,cliente_nome.ilike.%${debouncedColetaSearchTerm}%,cliente_nome_fantasia.ilike.%${debouncedColetaSearchTerm}%`);
    } else {
        if (debouncedClientSearchTerm) { // Filtrar por nome do cliente
            query = query.or(`cliente_nome.ilike.%${debouncedClientSearchTerm}%,cliente_nome_fantasia.ilike.%${debouncedClientSearchTerm}%`);
        }
        if (debouncedStartDate) {
            query = query.gte('data_coleta', debouncedStartDate);
        }
        if (debouncedEndDate) {
            const endOfDayDate = format(endOfDay(parseISO(debouncedEndDate)), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
            query = query.lte('data_coleta', endOfDayDate);
        }
    }

    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    const { data, error, count } = await query;
    
    if (error) {
        toast({ title: 'Erro ao carregar coletas', description: error.message, variant: 'destructive' });
        setColetas([]);
        setTotalCount(0);
    } else {
        setColetas(data || []);
        setTotalCount(count || 0);
    }
    setLoading(false);
  }, [profile, profileLoading, sortConfig, debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate, empresa, toast, currentPage, pageSize]);

  useEffect(() => {
    fetchColetas();
    fetchPeriodTotals();
  }, [fetchColetas, fetchPeriodTotals]);

  useEffect(() => {
    setCurrentPage(1);
    if(coletaSearchTerm) {
      setClientSearchTerm(''); // Limpa o filtro de cliente se estiver buscando por número de coleta
    }
  }, [debouncedColetaSearchTerm, debouncedClientSearchTerm, debouncedStartDate, debouncedEndDate, pageSize, coletaSearchTerm]); // Atualizado para debouncedClientSearchTerm

  const handleDelete = async (coletaId) => {
    const coletaToDelete = coletas.find(c => c.id === coletaId);
    if (!coletaToDelete) return;

    // A exclusão ainda deve ser feita na tabela 'coletas', não na view
    const { error } = await supabase.from('coletas').delete().eq('id', coletaId);
    
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      await logAction('delete_coleta_failed', { error: error.message, coleta_id: coletaId, numero_coleta: coletaToDelete.numero_coleta });
    } else {
      toast({ title: 'Coleta excluída!', description: 'A coleta foi removida com sucesso.' });
      await logAction('delete_coleta_success', { coleta_id: coletaId, numero_coleta: coletaToDelete.numero_coleta });
      fetchColetas();
      fetchPeriodTotals();
    }
  };
  
  const handleReciboAction = async (coletaId) => {
    const coleta = coletas.find(c => c.id === coletaId);
    if (coleta) {
      // A assinatura_url já vem da view, não precisa buscar novamente
      setSelectedColeta({ ...coleta, assinatura_url: coleta.assinatura_url }); 
      setReciboModalOpen(true);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

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
            <p className="text-emerald-200/80 mt-1">Visualize e gerencie as coletas realizadas.</p>
          </div>
          <Link to="/app/coletas/nova" className='w-full sm:w-auto'>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full rounded-xl">
              <PlusCircle className="mr-2 h-4 w-4" />
              Nova Coleta
            </Button>
          </Link>
        </motion.div>

        <ColetasFilters
          coletaSearchTerm={coletaSearchTerm}
          setColetaSearchTerm={setColetaSearchTerm}
          clientSearchTerm={clientSearchTerm} // Passar o novo estado
          setClientSearchTerm={setClientSearchTerm} // Passar o novo setter
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
           <ColetasTable
              coletas={coletas}
              sortConfig={sortConfig}
              requestSort={requestSort}
              handleOpenRecibo={handleReciboAction}
              handleDelete={handleDelete}
              totals={periodTotals}
              timezone={empresa?.timezone}
            />
        </motion.div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />

       {reciboModalOpen && selectedColeta && empresa && (
         <ReciboViewDialog
            coleta={selectedColeta}
            empresa={empresa}
            isOpen={reciboModalOpen}
            onClose={() => {
                setReciboModalOpen(false);
                fetchColetas(); // Recarrega a lista de coletas
                fetchPeriodTotals(); // Recarrega os totais
            }}
         />
       )}
      </div>
    </>
  );
};

export default ListaColetas;