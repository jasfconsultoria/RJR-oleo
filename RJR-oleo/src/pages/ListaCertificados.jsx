import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/contexts/ProfileContext';
import { CertificadosHeader } from '@/components/certificados/CertificadosHeader';
import { CertificadosFilters } from '@/components/certificados/CertificadosFilters';
import { CertificadosTable } from '@/components/certificados/CertificadosTable';
import { CertificadoViewDialog } from '@/components/certificados/CertificadoViewDialog';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatToISODate } from '@/lib/utils';

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
    selectedClientId: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'data_emissao', direction: 'desc' });
  const { profile, loading: profileLoading } = useProfile();
  const [clients, setClients] = useState([]);
  const [viewingCertificado, setViewingCertificado] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const debouncedFilters = useDebounce(filters, 500);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!profile) return;
      try {
        const [clientRes, empresaRes] = await Promise.all([
          supabase.from('clientes').select('id, nome, cnpj_cpf, municipio, estado').order('nome', { ascending: true }),
          supabase.from('empresa').select('*').single(),
        ]);

        if (clientRes.error) throw clientRes.error;
        setClients(clientRes.data || []);

        if (empresaRes.error) throw empresaRes.error;
        setEmpresa(empresaRes.data);
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

    const startDateISO = formatToISODate(debouncedFilters.startDate);
    const endDateISO = formatToISODate(debouncedFilters.endDate);

    let query = supabase
      .from('certificados')
      .select('id, cliente_id, cliente_nome, periodo_inicio, periodo_fim, total_kg, data_emissao', { count: 'exact' })
      .gte('data_emissao', `${startDateISO} 00:00:00`)
      .lte('data_emissao', `${endDateISO} 23:59:59`);

    if (debouncedFilters.selectedClientId) {
      query = query.eq('cliente_id', debouncedFilters.selectedClientId);
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

  const handleView = async (cert) => {
    const { data: clienteData, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', cert.cliente_id)
      .single();

    if (clienteError) {
      toast({ title: 'Erro ao carregar dados do cliente', variant: 'destructive' });
      return;
    }

    const fullCertData = {
      cliente: clienteData,
      empresa: empresa,
      periodo: { 
        inicio: cert.periodo_inicio, 
        fim: cert.periodo_fim 
      },
      totalKg: cert.total_kg,
      data_emissao: cert.data_emissao,
    };
    setViewingCertificado(fullCertData);
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
          clients={clients}
          selectedClientId={filters.selectedClientId}
          setSelectedClientId={(value) => handleFilterChange('selectedClientId', value)}
          startDate={filters.startDate}
          setStartDate={(value) => handleFilterChange('startDate', value)}
          endDate={filters.endDate}
          setEndDate={(value) => handleFilterChange('endDate', value)}
        />
        <div className="relative z-10">
          <CertificadosTable 
            loading={loading || profileLoading || !empresa}
            certificados={certificados}
            sortConfig={sortConfig}
            requestSort={requestSort}
            handleView={handleView}
            handleDelete={handleDelete}
          />
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </div>
      <CertificadoViewDialog 
        certificado={viewingCertificado}
        onOpenChange={(isOpen) => !isOpen && setViewingCertificado(null)}
      />
    </>
  );
};

export default ListaCertificados;