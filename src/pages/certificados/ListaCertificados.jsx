import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/contexts/ProfileContext';
import { CertificadosHeader } from '@/components/certificados/CertificadosHeader';
import { CertificadosFilters } from '@/components/certificados/CertificadosFilters';
import CertificadosTable from '@/components/certificados/CertificadosTable';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { formatToISODate } from '@/lib/utils';
import { motion } from 'framer-motion';
import { startOfMonth, endOfMonth, endOfDay } from 'date-fns';
import CertificadoViewModal from '@/components/certificados/CertificadoViewModal';
import { getZonedNow, getZonedStartOfMonth } from '@/lib/utils';

// Removidas funções locais baseadas em new Date() em favor de helpers em utils.js

const ListaCertificados = () => {
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    clientSearchTerm: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'data_emissao', direction: 'desc' });
  const { profile, loading: profileLoading } = useProfile();
  const [empresa, setEmpresa] = useState(null);
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const navigate = useNavigate();

  const debouncedFilters = useDebounce(filters, 500);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedCertificado, setSelectedCertificado] = useState(null);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!profile) return;
      try {
        const [empresaDataRes] = await Promise.all([
          supabase.from('empresa').select('*').single(),
        ]);

        if (empresaDataRes.error) throw empresaDataRes.error;
        const empresaData = empresaDataRes.data;
        setEmpresa(empresaData);

        // Inicializa datas com o timezone correto se for o primeiro load
        if (!filters.startDate) {
          setFilters(prev => ({
            ...prev,
            startDate: getZonedStartOfMonth(empresaData.timezone),
            endDate: getZonedNow(empresaData.timezone)
          }));
        }
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

    const endDateISO = endOfDay(new Date(debouncedFilters.endDate)).toISOString();

    let clientIds = [];
    if (debouncedFilters.clientSearchTerm) {
      const { data: matchingClients, error: clientError } = await supabase
        .from('clientes')
        .select('id')
        .or(`razao_social.ilike.%${debouncedFilters.clientSearchTerm}%,nome_fantasia.ilike.%${debouncedFilters.clientSearchTerm}%`);
      if (clientError) {
        console.error("Error fetching matching clients for certificates:", clientError);
        toast({ title: 'Erro ao buscar clientes para filtro', description: clientError.message, variant: 'destructive' });
        setCertificados([]);
        setTotalCount(0);
        setLoading(false);
        return;
      } else {
        clientIds = matchingClients.map(c => c.id);
        if (clientIds.length === 0) {
          setCertificados([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
      }
    }

    let query = supabase
      .from('certificados')
      .select(`
        *,
        cliente:clientes(id, nome_fantasia, razao_social)
      `, { count: 'exact' })
      .gte('data_emissao', new Date(debouncedFilters.startDate).toISOString())
      .lte('data_emissao', endDateISO);

    if (clientIds.length > 0) {
      query = query.in('cliente_id', clientIds);
    }

    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar certificados', description: error.message, variant: 'destructive' });
      setCertificados([]);
    } else {
      // Processar os dados para formatar o nome do cliente corretamente
      const processedData = (data || []).map(cert => {
        const nomeFantasia = cert.cliente?.nome_fantasia || '';
        const razaoSocial = cert.cliente?.razao_social || '';

        const clienteDisplay = nomeFantasia && razaoSocial
          ? `${nomeFantasia} - ${razaoSocial}`
          : nomeFantasia || razaoSocial;

        return {
          ...cert,
          cliente_display: clienteDisplay
        };
      });
      setCertificados(processedData);
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
      await logAction('delete_certificate_success', {
        certificate_id: certId,
        client_name: certToDelete.cliente_display
      });
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
          title: `Certificado - ${cert.cliente_display}`,
          text: `Confira o certificado de coleta de ${cert.cliente_display}.`,
          url: cert.pdf_url,
        });
      } catch (error) {
        toast({ title: 'Compartilhamento cancelado ou falhou.' });
      }
    } else {
      navigator.clipboard.writeText(cert.pdf_url);
      toast({ title: 'Link copiado!', description: 'O link do PDF foi copiado para a área de transferência.' });
    }
  };

  const handleEdit = (cert) => {
    navigate(`/app/certificados/editar/${cert.id}`);
  };

  const handleOpenViewModal = (cert) => {
    setSelectedCertificado(cert);
    setIsViewModalOpen(true);
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
    setFilters(prev => ({ ...prev, [field]: value }));
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
          clientSearchTerm={filters.clientSearchTerm}
          setClientSearchTerm={(value) => handleFilterChange('clientSearchTerm', value)}
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
            handleOpenViewModal={handleOpenViewModal}
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

      {isViewModalOpen && selectedCertificado && (
        <CertificadoViewModal
          certificado={selectedCertificado}
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
        />
      )}
    </>
  );
};

export default ListaCertificados;