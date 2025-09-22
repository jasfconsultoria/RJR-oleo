import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/contexts/ProfileContext';
import { CertificadosHeader } from '@/components/certificados/CertificadosHeader';
import { CertificadosFilters } from '@/components/certificados/CertificadosFilters';
import { CertificadosTable } from '@/components/certificados/CertificadosTable';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatToISODate } from '@/lib/utils';
import { motion } from 'framer-motion';

const getTodayDate = () => new Date();
const getFirstDayOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const ListaCertificados = () => {
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ 
    startDate: getFirstDayOfMonth(),
    endDate: getTodayDate(),
    clientSearchTerm: '', // Alterado de selectedClientId para clientSearchTerm
  });
  const [sortConfig, setSortConfig] = useState({ key: 'data_emissao', direction: 'desc' });
  const { profile, loading: profileLoading } = useProfile();
  // Removido: [clients, setClients] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();

  const debouncedFilters = useDebounce(filters, 500);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!profile) return;
      try {
        const [empresaDataRes] = await Promise.all([
          // Removido: supabase.from('clientes').select(...)
          supabase.from('empresa').select('*').single(),
        ]);

        // Removido: if (clientDataRes.error) throw clientDataRes.error;
        // Removido: setClients(clientDataRes.data || []);

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

  const fetchCertificados = useCallback(async () => {
    if (!empresa || !debouncedFilters.startDate || !debouncedFilters.endDate) return;
    
    setLoading(true);
    
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const startDate = new Date(debouncedFilters.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(debouncedFilters.endDate);
    endDate.setHours(23, 59, 59, 999);

    let query = supabase
      .from('certificados')
      .select(`
        *,
        cliente:clientes(nome, nome_fantasia)
      `, { count: 'exact' })
      .gte('data_emissao', startDate.toISOString())
      .lte('data_emissao', endDate.toISOString());

    if (debouncedFilters.clientSearchTerm) { // Filtrar por nome do cliente
      query = query.or(`cliente.nome.ilike.%${debouncedFilters.clientSearchTerm}%,cliente.nome_fantasia.ilike.%${debouncedFilters.clientSearchTerm}%`);
    }
    
    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar certificados', description: error.message, variant: 'destructive' });
      setCertificados([]);
    } else {
      setCertificados(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [empresa, currentPage, pageSize, debouncedFilters, sortConfig, toast]);

  useEffect(() => {
    if (empresa) {
        fetchCertificados();
    }
  }, [fetchCertificados, empresa]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedFilters, pageSize]);

  const handleDelete = async (certId) => {
    const certToDelete = certificados.find(c => c.id === certId);
    if (!certToDelete) return;

    const { error } = await supabase.from('certificados').delete().eq('id', certId);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      await logAction('delete_certificate_failed', { error: error.message, certificate_id: certId });
    } else {
      toast({ title: 'Certificado excluído!', description: 'O certificado foi removido com sucesso.' });
      await logAction('delete_certificate_success', { certificate_id: certId, client_name: certToDelete.cliente_nome });
      fetchCertificados();
    }
  };

  const handleOpenPdf = (cert) => {
    if (cert.pdf_url) {
      const url = `${cert.pdf_url}?t=${new Date().getTime()}`;
      window.open(url, '_blank');
    } else {
      toast({ title: 'PDF não gerado', description: 'Redirecionando para gerar o PDF...', variant: 'default' });
      navigate(`/app/certificados/view/${cert.id}`, { state: { autoGenerate: true } });
    }
  };

  const handleShare = async (cert) => {
    if (!cert.pdf_url) {
      toast({ title: 'PDF não encontrado', description: 'Gere o PDF primeiro para poder compartilhar.', variant: 'destructive' });
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificado - ${cert.cliente.nome}`,
          text: `Confira o certificado de coleta de ${cert.cliente.nome}.`,
          url: cert.pdf_url,
        });
      } catch (error) {
        toast({ title: 'Compartilhamento cancelado ou falhou.' });
      }
    } else {
      navigator.clipboard.writeText(cert.pdf_url);
      toast({ title: 'Link copiado!', description: 'O link do PDF foi copido para a área de transferência.' });
    }
  };

  const handleEdit = (cert) => {
    navigate(`/app/certificados/editar/${cert.id}`);
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

  const totalPages = Math.ceil(totalCount / pageSize);
  
  return (
    <>
      <Helmet>
        <title>Lista de Certificados - Sistema RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <CertificadosHeader 
          certificados={certificados} 
          startDate={filters.startDate ? formatToISODate(filters.startDate) : ''} 
          endDate={filters.endDate ? formatToISODate(filters.endDate) : ''} 
        />
        <CertificadosFilters 
          // Removido: clients={clients}
          clientSearchTerm={filters.clientSearchTerm} // Passar o novo estado
          setClientSearchTerm={(value) => handleFilterChange('clientSearchTerm', value)} // Passar o novo setter
          startDate={filters.startDate}
          setStartDate={(value) => handleFilterChange('startDate', value)}
          endDate={filters.endDate}
          setEndDate={(value) => handleFilterChange('endDate', value)}
        />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl relative z-10">
          <CertificadosTable 
            loading={loading || profileLoading || !empresa}
            certificados={certificados}
            sortConfig={sortConfig}
            requestSort={requestSort}
            handleOpenPdf={handleOpenPdf}
            handleShare={handleShare}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
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
    </>
  );
};

export default ListaCertificados;