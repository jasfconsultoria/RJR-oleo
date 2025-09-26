import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
// import ColetasFilters from '@/components/coletas/ColetasFilters'; // Temporariamente comentado
// import ColetasTable from '@/components/coletas/ColetasTable'; // Temporariamente comentado
import { startOfMonth, format, endOfDay, parseISO, endOfMonth } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
// import { ReciboViewDialog } from '@/components/coletas/ReciboViewDialog'; // Temporariamente comentado

const ListaColetas = () => {
  console.log('ListaColetas component is attempting to render.'); // Adicionado para depuração

  const [loading, setLoading] = useState(true); // Manter estado de carregamento para mostrar algo
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();

  // Simular carregamento por um momento
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000); // Simular 1 segundo de carregamento
    return () => clearTimeout(timer);
  }, []);

  if (profileLoading || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Teste de Renderização - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6 p-4">
        <h1 className="text-3xl font-bold text-white">Lista de Coletas - Teste</h1>
        <p className="text-emerald-200">Se você está vendo isso, o componente está renderizando!</p>
        <Button onClick={() => toast({ title: 'Teste de Toast', description: 'Toast funcionando!' })}>
          Testar Toast
        </Button>
      </div>
    </>
  );
};

export default ListaColetas;