import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { PlusCircle, Loader2, FileText, Edit, Trash2, Share2, Receipt, Clock } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { logAction } from '@/lib/logger';
import { Pagination } from '@/components/ui/pagination';
import { useDebounce } from '@/hooks/useDebounce';
import { ReciboAvulsoViewDialog } from '@/components/recibos-avulsos/ReciboAvulsoViewDialog';
import { formatCurrency, formatCnpjCpf } from '@/lib/utils';
import RecibosFilters from '@/components/recibos-avulsos/RecibosFilters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const ListaRecibosAvulsos = () => {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'data_recibo', direction: 'desc' });
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [reciboModalOpen, setReciboModalOpen] = useState(false);
  const [selectedRecibo, setSelectedRecibo] = useState(null);
  const [returnPath, setReturnPath] = useState(null);
  const [empresa, setEmpresa] = useState({
    items_per_page: 25,
    timezone: 'America/Sao_Paulo',
    nome_fantasia: 'Nome da Empresa',
    razao_social: 'Razão Social da Empresa',
    cnpj: 'N/A',
    telefone: '',
    email: '',
    endereco: '',
    logo_documento_url: null
  });

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reciboToDelete, setReciboToDelete] = useState(null);

  // Estados para fluxo de exclusão
  const [deleteRequestDialogOpen, setDeleteRequestDialogOpen] = useState(false);
  const [deleteRequestRecibo, setDeleteRequestRecibo] = useState(null);
  const [deleteRequestMotivo, setDeleteRequestMotivo] = useState('');
  const [deleteRequestSubmitting, setDeleteRequestSubmitting] = useState(false);
  const [reviewSubmittingId, setReviewSubmittingId] = useState(null);
  const [selectedReviewDecision, setSelectedReviewDecision] = useState('approved');

  const isCollector = profile?.role === 'coletor';
  const canReviewDelete = ['administrador', 'gerente', 'super_admin'].includes(profile?.role);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedStartDate = useDebounce(startDate, 500);
  const debouncedEndDate = useDebounce(endDate, 500);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresaData = async () => {
      try {
        const { data, error } = await supabase.from('empresa').select('*').single();
        if (error) {
          console.warn("Usando configuração padrão para empresa");
        }
        setEmpresa(data || {
          items_per_page: 25,
          timezone: 'America/Sao_Paulo',
          nome_fantasia: 'Nome da Empresa',
          razao_social: 'Razão Social da Empresa',
          cnpj: 'N/A',
          telefone: '',
          email: '',
          endereco: '',
          municipio: '',
          estado: '',
          logo_documento_url: null
        });
      } catch (error) {
        console.error("Erro ao buscar empresa:", error);
        setEmpresa({
          items_per_page: 25,
          timezone: 'America/Sao_Paulo',
          nome_fantasia: 'Nome da Empresa',
          razao_social: 'Razão Social da Empresa',
          cnpj: 'N/A',
          telefone: '',
          email: '',
          endereco: '',
          logo_documento_url: null
        });
      }
    };
    fetchEmpresaData();
  }, []);

  const refreshRecibosData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('v_recibos_avulso_com_status')
        .select('*', { count: 'exact' });

      // Filtro por perfil: coletores só veem seus próprios recibos
      if (profile?.role === 'coletor' && profile?.id) {
        query = query.eq('user_id', profile.id);
      }

      // Filtros
      if (debouncedSearchTerm) {
        query = query.or(`pessoa_nome.ilike.%${debouncedSearchTerm}%,numero_recibo.ilike.%${debouncedSearchTerm}%,descricao.ilike.%${debouncedSearchTerm}%`);
      }

      if (tipoFilter !== 'all') {
        query = query.eq('tipo', tipoFilter);
      }

      if (debouncedStartDate) {
        query = query.gte('data_recibo', debouncedStartDate);
      }

      if (debouncedEndDate) {
        query = query.lte('data_recibo', debouncedEndDate);
      }

      // Ordenação
      query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });

      // Paginação
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      setRecibos(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Erro ao buscar recibos:', error);
      toast({
        title: 'Erro ao carregar recibos',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, tipoFilter, debouncedStartDate, debouncedEndDate, sortConfig, currentPage, pageSize, toast, profile]);

  useEffect(() => {
    refreshRecibosData();
  }, [refreshRecibosData]);

  // Efeito para abrir o recibo vindo do FinanceiroForm
  useEffect(() => {
    if (!loading && location.state?.openReciboId && recibos.length > 0) {
      const reciboToOpen = recibos.find(r => r.id === location.state.openReciboId);
      if (reciboToOpen) {
        setSelectedRecibo(reciboToOpen);
        setReciboModalOpen(true);
        // Se houver um caminho de retorno, salvamos antes de limpar o state
        if (location.state.returnPath) {
          setReturnPath(location.state.returnPath);
        }
        // Limpar o estado para não reabrir ao navegar de volta
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [loading, location.state, recibos, navigate, location.pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, tipoFilter, debouncedStartDate, debouncedEndDate]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleCollectorDeleteAttempt = (recibo) => {
    if (recibo?.delete_request_status === 'pending') {
      toast({
        title: 'Solicitação já enviada',
        description: 'Este recibo já está aguardando aprovação do Administrador.',
      });
      return;
    }

    toast({
      title: 'Exclusão restrita',
      description: 'Solicite ao Administrador que efetue a exclusão.',
    });
  };

  const handleDelete = async (reciboId) => {
    const recibo = recibos.find(r => r.id === reciboId);
    if (!recibo) return;

    if (isCollector) {
      if (recibo.delete_request_status === 'pending') {
        toast({
          title: 'Solicitação já enviada',
          description: 'Este recibo já está aguardando aprovação do Administrador.',
        });
        return;
      }

      setDeleteRequestRecibo(recibo);
      setDeleteRequestMotivo('');
      setDeleteRequestDialogOpen(true);
      return;
    }

    const { error } = await supabase
      .from('recibos_avulso')
      .delete()
      .eq('id', recibo.id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
      await logAction('delete_recibo_avulso_failed', { error: error.message, recibo_id: recibo.id });
    } else {
      toast({
        title: 'Recibo excluído!',
        description: 'O recibo foi removido com sucesso.'
      });
      await logAction('delete_recibo_avulso_success', { recibo_id: recibo.id, numero_recibo: recibo.numero_recibo });
      refreshRecibosData();
    }
  };

  const handleSubmitDeleteRequest = async () => {
    if (!deleteRequestRecibo) return;

    if (deleteRequestMotivo.trim().length < 5) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe um motivo com pelo menos 5 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteRequestSubmitting(true);

    try {
      const { error } = await supabase.rpc('request_recibo_avulso_delete', {
        p_recibo_avulso_id: deleteRequestRecibo.id,
        p_motivo: deleteRequestMotivo.trim(),
      });

      if (error) throw error;

      toast({
        title: 'Solicitação enviada',
        description: 'O recibo ficou marcado como pendente para aprovação do Administrador.',
      });
      await logAction('request_delete_recibo_avulso_success', {
        recibo_id: deleteRequestRecibo.id,
        numero_recibo: deleteRequestRecibo.numero_recibo,
      });
      setDeleteRequestDialogOpen(false);
      setDeleteRequestRecibo(null);
      setDeleteRequestMotivo('');
      refreshRecibosData();
    } catch (error) {
      toast({
        title: 'Erro ao solicitar exclusão',
        description: error.message,
        variant: 'destructive',
      });
      await logAction('request_delete_recibo_avulso_failed', {
        error: error.message,
        recibo_id: deleteRequestRecibo.id,
        numero_recibo: deleteRequestRecibo.numero_recibo,
      });
    } finally {
      setDeleteRequestSubmitting(false);
    }
  };

  const handleReviewDeleteRequest = async (recibo, decision) => {
    if (!recibo?.delete_request_id) return;

    const submittingKey = `${recibo.delete_request_id}-${decision}`;
    setReviewSubmittingId(submittingKey);

    try {
      const { error } = await supabase.rpc('review_recibo_avulso_delete_request', {
        p_request_id: recibo.delete_request_id,
        p_decision: decision,
        p_observacao: null,
      });

      if (error) throw error;

      const approved = decision === 'approved';
      toast({
        title: approved ? 'Exclusão aprovada' : 'Exclusão rejeitada',
        description: approved ? 'O recibo foi excluído com sucesso.' : 'O recibo foi mantido na lista.',
      });
      await logAction(approved ? 'approve_delete_recibo_request' : 'reject_delete_recibo_request', {
        recibo_id: recibo.id,
        numero_recibo: recibo.numero_recibo,
        request_id: recibo.delete_request_id,
      });
      refreshRecibosData();
    } catch (error) {
      toast({
        title: 'Erro ao revisar solicitação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setReviewSubmittingId(null);
    }
  };

  const handleReciboAction = async (reciboId) => {
    const recibo = recibos.find(r => r.id === reciboId);
    if (recibo) {
      setSelectedRecibo(recibo);
      setReciboModalOpen(true);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getStatusBadge = (recibo) => {
    if (recibo.assinatura_url) {
      return { text: 'Assinado', className: 'bg-green-500/20 text-green-300' };
    }
    return { text: 'Pendente', className: 'bg-yellow-500/20 text-yellow-300' };
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      'cliente': 'Cliente',
      'fornecedor': 'Fornecedor',
      'coletor': 'Coletor'
    };
    return labels[tipo] || tipo;
  };

  return (
    <>
      <Helmet>
        <title>Recibos Avulsos - RJR Óleo</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
              <Receipt className="w-8 h-8 text-emerald-400" /> Recibos Avulsos
              {profile?.role === 'coletor' && (
                <span className="text-sm text-emerald-300 bg-emerald-800/30 px-2 py-1 rounded-lg">
                  Meus Recibos
                </span>
              )}
              {['super_admin', 'administrador', 'gerente'].includes(profile?.role) && (
                <span className="text-sm text-blue-300 bg-blue-800/30 px-2 py-1 rounded-lg">
                  Todos os Recibos
                </span>
              )}
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie recibos para clientes, fornecedores e coletores</p>
          </div>
          <Link to="/app/financeiro/recibos/novo">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Recibo
            </Button>
          </Link>
        </div>

        <RecibosFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          tipoFilter={tipoFilter}
          setTipoFilter={setTipoFilter}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />

        {/* Tabela */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl"
        >
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('numero_recibo')}>
                      Nº Recibo {sortConfig.key === 'numero_recibo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('data_recibo')}>
                      Data {sortConfig.key === 'data_recibo' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300">Tipo</TableHead>
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('pessoa_nome')}>
                      Nome {sortConfig.key === 'pessoa_nome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300">Descrição</TableHead>
                    <TableHead className="text-emerald-300 cursor-pointer" onClick={() => requestSort('valor')}>
                      Valor {sortConfig.key === 'valor' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </TableHead>
                    <TableHead className="text-emerald-300">Status</TableHead>
                    <TableHead className="text-emerald-300 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recibos.length > 0 ? (
                    recibos.map((recibo) => {
                      const statusInfo = getStatusBadge(recibo);
                      const isDeletePending = recibo.delete_request_status === 'pending';
                      const isReviewSubmitting = reviewSubmittingId?.startsWith(`${recibo.delete_request_id}-`);
                      
                      return (
                        <TableRow key={recibo.id} className="border-b border-white/10 hover:bg-white/5">
                          <TableCell className="font-semibold text-white">
                            {recibo.numero_recibo?.toString().padStart(6, '0')}
                          </TableCell>
                          <TableCell className="text-white">
                            {format(parseISO(recibo.data_recibo), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="text-white">
                            {getTipoLabel(recibo.tipo)}
                          </TableCell>
                          <TableCell className="text-white">
                            <div className="font-semibold drop-shadow-sm">{recibo.pessoa_nome}</div>
                            {recibo.pessoa_cnpj_cpf && <div className="text-xs text-white/50">{formatCnpjCpf(recibo.pessoa_cnpj_cpf)}</div>}
                          </TableCell>
                          <TableCell className="text-white max-w-xs truncate" title={recibo.descricao}>
                            {recibo.descricao}
                          </TableCell>
                          <TableCell className="text-white font-semibold">
                            {formatCurrency(recibo.valor || 0)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-start gap-1">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}>
                                {statusInfo.text}
                              </span>
                              {isDeletePending && (
                                <span className="px-2 py-1 rounded-xl text-xs font-semibold bg-yellow-500/20 text-yellow-300 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Exclusão pendente
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleReciboAction(recibo.id)}
                                title="Ver Recibo"
                                className="text-blue-400 hover:text-blue-300 rounded-xl"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate(`/app/financeiro/recibos/editar/${recibo.id}`)}
                                title={recibo.assinatura_url ? "Recibo assinado não pode ser editado" : "Editar Recibo"}
                                disabled={!!recibo.assinatura_url}
                                className="text-yellow-400 hover:text-yellow-300 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>

                              {isDeletePending && canReviewDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-yellow-400 hover:text-yellow-300 rounded-xl"
                                      title="Revisar solicitação de exclusão"
                                      disabled={isReviewSubmitting}
                                      onClick={() => setSelectedReviewDecision('approved')}
                                    >
                                      {isReviewSubmitting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Revisar solicitação de exclusão</AlertDialogTitle>
                                      <AlertDialogDescription className="text-emerald-300">
                                        Recibo Nº {recibo.numero_recibo?.toString().padStart(6, '0')}. Motivo informado: {recibo.delete_request_motivo || 'Não informado'}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <RadioGroup
                                      value={selectedReviewDecision}
                                      onValueChange={setSelectedReviewDecision}
                                      className="space-y-3"
                                    >
                                      <label className="flex items-center gap-3 rounded-xl border border-emerald-700/70 bg-emerald-950/40 p-3 text-sm text-emerald-50 cursor-pointer">
                                        <RadioGroupItem value="approved" className="border-emerald-300 text-emerald-300" />
                                        <span>Aprovar exclusão</span>
                                      </label>
                                      <label className="flex items-center gap-3 rounded-xl border border-emerald-700/70 bg-emerald-950/40 p-3 text-sm text-emerald-50 cursor-pointer">
                                        <RadioGroupItem value="rejected" className="border-red-300 text-red-300" />
                                        <span>Rejeitar solicitação</span>
                                      </label>
                                    </RadioGroup>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleReviewDeleteRequest(recibo, selectedReviewDecision)}
                                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                                      >
                                        Confirmar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}

                              {isDeletePending && isCollector && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-yellow-300 rounded-xl cursor-not-allowed opacity-70"
                                  title="Exclusão pendente de aprovação"
                                  disabled
                                >
                                  <Clock className="h-4 w-4" />
                                </Button>
                              )}

                              {!isDeletePending && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-red-400 hover:text-red-300 rounded-xl"
                                      title="Excluir Recibo"
                                      onClick={() => {
                                        if (isCollector) {
                                          handleCollectorDeleteAttempt?.(recibo);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{isCollector ? 'Deseja realmente excluir esse recibo?' : 'Você tem certeza?'}</AlertDialogTitle>
                                      <AlertDialogDescription className="text-emerald-300">
                                        {isCollector
                                          ? `Ao confirmar, você deverá informar o motivo. O recibo Nº ${recibo.numero_recibo?.toString().padStart(6, '0')} ficará pendente para aprovação do Administrador.`
                                          : `Esta ação não pode ser desfeita. Isso deletará permanentemente o recibo Nº ${recibo.numero_recibo?.toString().padStart(6, '0')}.`
                                        }
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(recibo.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
                                        {isCollector ? 'Sim, informar motivo' : 'Deletar'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-white py-8">
                        Nenhum recibo encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </motion.div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />

        {reciboModalOpen && selectedRecibo && (
          <ReciboAvulsoViewDialog
            recibo={selectedRecibo}
            empresa={empresa}
            isOpen={reciboModalOpen}
            onClose={() => {
              setReciboModalOpen(false);
              if (returnPath) {
                navigate(returnPath);
                setReturnPath(null); // Limpar após o uso
              } else {
                setTimeout(() => {
                  refreshRecibosData();
                }, 1000);
              }
            }}
          />
        )}

        <Dialog open={deleteRequestDialogOpen} onOpenChange={setDeleteRequestDialogOpen}>
          <DialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
            <DialogHeader>
              <DialogTitle>Solicitar exclusão de recibo</DialogTitle>
              <DialogDescription className="text-emerald-200">
                Informe o motivo para solicitar a exclusão do recibo Nº {deleteRequestRecibo ? String(deleteRequestRecibo.numero_recibo).padStart(6, '0') : ''}. O Administrador precisará aprovar antes da exclusão.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-request-motivo" className="text-emerald-100">
                Motivo da solicitação *
              </Label>
              <Textarea
                id="delete-request-motivo"
                value={deleteRequestMotivo}
                onChange={(event) => setDeleteRequestMotivo(event.target.value)}
                placeholder="Descreva o motivo da solicitação..."
                className="min-h-[120px] bg-emerald-950/50 border-emerald-500/50 text-white placeholder:text-emerald-200/50"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteRequestDialogOpen(false)}
                className="border-gray-500 text-gray-300 rounded-xl"
                disabled={deleteRequestSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSubmitDeleteRequest}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                disabled={deleteRequestSubmitting}
              >
                {deleteRequestSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Solicitação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default ListaRecibosAvulsos;
