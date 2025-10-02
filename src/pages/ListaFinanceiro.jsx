import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableFooter, TableHead } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, Search, DollarSign, Eye, Receipt, Banknote, Tag, ClipboardList, CalendarIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { formatCnpjCpf, formatCurrency, formatNumber, formatDateWithTimezone, cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PaymentDialog from '@/components/financeiro/PaymentDialog';
import PaymentHistoryDialog from '@/components/financeiro/PaymentHistoryDialog';
import { DatePicker } from '@/components/ui/date-picker'; // Import DatePicker
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip components

// Helper component for sortable table headers
const TableHeaderSortable = ({ columnKey, label, sortConfig, onSort, className }) => {
  const getSortIcon = () => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-4 h-4 ml-1" />
      : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  return (
    <TableHead
      onClick={() => onSort(columnKey)}
      className={cn("cursor-pointer text-emerald-300", className)}
    >
      <div className="flex items-center">
        {label} {getSortIcon()}
      </div>
    </TableHead>
  );
};

const ListaFinanceiro = ({ type }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [sortConfig, setSortConfig] = useState({ key: 'issue_date', direction: 'desc' }); // Novo estado de ordenação
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const debouncedClientSearchTerm = useDebounce(clientSearchTerm, 500);
  const debouncedStartDate = useDebounce(startDate ? format(startDate, 'yyyy-MM-dd') : null, 500);
  const debouncedEndDate = useDebounce(endDate ? format(endDate, 'yyyy-MM-dd') : null, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);
  const [summary, setSummary] = useState({ total_value: 0, total_paid: 0, total_balance: 0 });
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [dialogKey, setDialogKey] = useState(Date.now());

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  const title = type === 'credito' ? 'Crédito' : 'Débito';
  const entityLabel = type === 'credito' ? 'Cliente' : 'Fornecedor';

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page, timezone').single();
      if (error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
      else setEmpresa(data || { items_per_page: 25, timezone: 'America/Sao_Paulo' });
    };
    fetchEmpresa();
  }, [toast]);

  const fetchEntries = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    const from = (currentPage - 1) * pageSize;

    const startDateISO = debouncedStartDate || null;
    const endDateISO = debouncedEndDate || null;

    // Parâmetros para a função RPC get_financeiro_detailed_receipt como um OBJETO
    const rpcParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: type,
      p_status: statusFilter === 'all' ? null : statusFilter,
      p_client_search_term: debouncedSearchTerm || debouncedClientSearchTerm || null,
      p_cost_center: null, // p_cost_center (não implementado neste relatório)
      p_offset: from,
      p_limit: pageSize,
      p_sort_column: sortConfig.key,
      p_sort_direction: sortConfig.direction,
    };

    // Fetch paginated data
    const { data: entriesData, error: entriesError } = await supabase.rpc('get_financeiro_detailed_receipt', rpcParams);

    // Parâmetros para a função RPC get_financeiro_detailed_receipt_count como um OBJETO
    const rpcCountParams = {
      p_start_date: startDateISO,
      p_end_date: endDateISO,
      p_type: type,
      p_status: statusFilter === 'all' ? null : statusFilter,
      p_client_search_term: debouncedSearchTerm || debouncedClientSearchTerm || null,
      p_cost_center: null, // p_cost_center
    };
    const { data: countData, error: countError } = await supabase.rpc('get_financeiro_detailed_receipt_count', rpcCountParams);

    if (entriesError) {
      toast({ title: `Erro ao buscar ${title}s`, description: `Falha na consulta: ${entriesError.message}`, variant: 'destructive' });
      setEntries([]);
      setTotalCount(0);
    } else if (countError) {
      toast({ title: `Erro ao buscar contagem de ${title}s`, description: `Falha na consulta de contagem: ${countError.message}`, variant: 'destructive' });
      setEntries(entriesData || []);
      setTotalCount(0); // Set to 0 if count fails
    } else {
      setEntries(entriesData || []);
      setTotalCount(countData || 0);
    }
    setLoading(false);
  }, [toast, currentPage, pageSize, type, debouncedSearchTerm, debouncedClientSearchTerm, statusFilter, debouncedStartDate, debouncedEndDate, empresa, title, sortConfig]); // Adicionado sortConfig às dependências

  const fetchSummary = useCallback(async () => {
    if (!empresa) return;
    // Parâmetros para a função RPC get_financeiro_summary como um OBJETO
    const rpcSummaryParams = {
      p_start_date: debouncedStartDate || null,
      p_end_date: debouncedEndDate || null,
      p_type: type,
      p_status: statusFilter === 'all' ? null : statusFilter,
      p_client_search_term: debouncedSearchTerm || debouncedClientSearchTerm || null,
      p_cost_center: null, // p_cost_center
    };
    let { data, error } = await supabase.rpc('get_financeiro_summary', rpcSummaryParams); // <-- Alterado para get_financeiro_summary

    if (error) {
      console.error("Erro ao buscar resumo financeiro:", error);
      setSummary({ total_value: 0, total_paid: 0, total_balance: 0 });
    } else {
      setSummary(data || { total_value: 0, total_paid: 0, total_balance: 0 });
    }
  }, [type, statusFilter, debouncedStartDate, debouncedEndDate, empresa, debouncedSearchTerm, debouncedClientSearchTerm]);

  useEffect(() => {
    if (empresa) {
      fetchEntries();
      fetchSummary();
    }
  }, [fetchEntries, fetchSummary, empresa]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, debouncedClientSearchTerm, statusFilter, debouncedStartDate, debouncedEndDate, pageSize, sortConfig]); // Adicionado sortConfig às dependências

  const handleDelete = async (id, description) => {
    const { error } = await supabase.from('credito_debito').delete().eq('id', id);
    if (error) {
      toast({ title: `Erro ao deletar ${title}`, description: error.message, variant: 'destructive' });
    } else {
      await logAction(`delete_${type}_entry`, { details: { entry_id: id, description: description } });
      toast({ title: `${title} deletado com sucesso` });
      fetchEntries();
      fetchSummary();
    }
  };

  const handleOpenPaymentModal = (entry) => {
    setSelectedEntry(entry);
    setDialogKey(Date.now());
    setIsPaymentModalOpen(true);
  };

  const handleOpenHistoryModal = (entry) => {
    setSelectedEntry(entry);
    setIsHistoryModalOpen(true);
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Resetar para a primeira página ao mudar a ordenação
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-300';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'partially_paid':
        return 'bg-blue-500/20 text-blue-300';
      case 'overdue':
        return 'bg-red-500/20 text-red-300';
      case 'canceled':
        return 'bg-gray-500/20 text-gray-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Quitado';
      case 'pending': return 'Pendente';
      case 'partially_paid': return 'Parcialmente Pago';
      case 'overdue': return 'Vencido';
      case 'canceled': return 'Cancelado';
      default: return status;
    }
  };

  const getClientDisplayName = (entry) => {
    return entry.cliente_fornecedor_fantasy_name ? `${entry.cliente_fornecedor_name} - ${entry.cliente_fornecedor_fantasy_name}` : entry.cliente_fornecedor_name;
  };

  return (
    <>
      <Helmet><title>Lista de {title}s - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-emerald-400" /> Lista de {title}s
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie as contas a {type === 'credito' ? 'receber' : 'pagar'}.</p>
          </div>
          <Button onClick={() => navigate(`/app/financeiro/${type}/novo`)} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo {title}
          </Button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="searchTerm"
                  type="search"
                  placeholder="Nº Doc, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">{entityLabel}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="clientSearch"
                  type="search"
                  placeholder={`Buscar por nome d${entityLabel.toLowerCase()}...`}
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="statusFilter" className="block text-white mb-1 text-sm">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="partially_paid">Parcialmente Pago</SelectItem>
                  <SelectItem value="paid">Quitado</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="canceled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Venc. Início</Label>
                <DatePicker
                  date={startDate}
                  setDate={setStartDate}
                  className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Venc. Fim</Label>
                <DatePicker
                  date={endDate}
                  setDate={setEndDate}
                  className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <TableHeaderSortable columnKey="document_number" label="Documento" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHeaderSortable columnKey="cliente_fornecedor_name" label={entityLabel} sortConfig={sortConfig} onSort={requestSort} />
                    <TableHead className="p-2 text-left text-white">Descrição</TableHead>
                    <TableHead className="p-2 text-center text-white">Parcela</TableHead>
                    <TableHeaderSortable columnKey="issue_date" label="Vencimento" sortConfig={sortConfig} onSort={requestSort} />
                    <TableHeaderSortable columnKey="total_value" label="Valor" sortConfig={sortConfig} onSort={requestSort} className="text-right" />
                    <TableHeaderSortable columnKey="paid_amount" label="Pago" sortConfig={sortConfig} onSort={requestSort} className="text-right" />
                    <TableHeaderSortable columnKey="amount_balance" label="Saldo" sortConfig={sortConfig} onSort={requestSort} className="text-right" />
                    <TableHeaderSortable columnKey="status" label="Status" sortConfig={sortConfig} onSort={requestSort} className="text-center" />
                    <TableHead className="p-2 text-right text-white">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length > 0 ? (
                    entries.map(entry => {
                      const installmentDenominator = entry.has_down_payment ? entry.total_installments - 1 : entry.total_installments;
                      const isLinkedToColeta = !!entry.coleta_id;
                      const isReceiptSigned = !!entry.recibo_assinatura_url;
                      const isPaidOrCanceled = entry.status === 'paid' || entry.status === 'canceled';

                      const isDisabledPayment = isPaidOrCanceled || (isLinkedToColeta && !isReceiptSigned);
                      let paymentTooltipMessage = '';
                      if (isPaidOrCanceled) {
                        paymentTooltipMessage = 'Não é possível registrar pagamento para lançamentos quitados ou cancelados.';
                      } else if (isLinkedToColeta && !isReceiptSigned) {
                        paymentTooltipMessage = 'O recibo da coleta ainda não foi assinado. O pagamento é feito via recibo.';
                      }

                      return (
                        <TableRow key={entry.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Documento">{entry.document_number || 'N/A'}</TableCell>
                          <TableCell data-label={entityLabel}>{getClientDisplayName(entry)}</TableCell>
                          <TableCell data-label="Descrição">{entry.description}</TableCell>
                          <TableCell data-label="Parcela" className="text-center">
                            {entry.installment_number === 0 ? 'Entrada' : `${entry.installment_number}/${installmentDenominator}`}
                          </TableCell>
                          <TableCell data-label="Vencimento">{formatDateWithTimezone(entry.issue_date, empresa?.timezone)}</TableCell>
                          <TableCell data-label="Valor" className="text-right">{formatCurrency(entry.total_value)}</TableCell>
                          <TableCell data-label="Pago" className="text-right">{formatCurrency(entry.paid_amount)}</TableCell>
                          <TableCell data-label="Saldo" className="text-right font-bold">{formatCurrency(entry.amount_balance)}</TableCell>
                          <TableCell data-label="Status" className="text-center">
                            <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getStatusBadge(entry.status)}`}>
                              {getStatusText(entry.status)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right actions-cell">
                            <TooltipProvider>
                              <div className="flex justify-end items-center gap-1">
                                {/* Botão Registrar Pagamento */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      title="Registrar Pagamento" 
                                      className={`text-green-400 hover:text-green-300 rounded-xl ${isDisabledPayment ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                      onClick={() => handleOpenPaymentModal(entry)} 
                                      disabled={isDisabledPayment}
                                    >
                                        <Banknote className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  {isDisabledPayment && (
                                    <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                      <p>{paymentTooltipMessage}</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>

                                {/* Botão Histórico de Pagamentos (Detalhes do Pagamento) */}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="Detalhes do Pagamento" 
                                  className="text-blue-400 hover:text-blue-300 rounded-xl" 
                                  onClick={() => handleOpenHistoryModal(entry)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                {/* Botão Editar Lançamento (visível para todos os status, desabilitado se vinculado a coleta) */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      title="Editar Lançamento" 
                                      className={`text-yellow-400 hover:text-yellow-300 rounded-xl ${isLinkedToColeta ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                      onClick={() => navigate(`/app/financeiro/${type}/editar/${entry.id}`)}
                                      disabled={isLinkedToColeta}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  {isLinkedToColeta && (
                                    <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                      <p>Lançamentos de coletas devem ser editados na coleta de origem.</p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>

                                {/* Botão Excluir */}
                                <AlertDialog>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        title="Excluir" 
                                        className={`text-red-400 hover:text-red-300 rounded-xl ${isLinkedToColeta ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        disabled={isLinkedToColeta}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    {isLinkedToColeta && (
                                      <TooltipContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                        <p>Lançamentos de coletas devem ser excluídos na coleta de origem.</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                  <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                      <AlertDialogDescription className="text-emerald-300">Essa ação não pode ser desfeita. Isso deletará permanentemente o lançamento {entry.document_number || entry.description}.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(entry.id, entry.description)} className="bg-red-500 hover:bg-red-600 rounded-xl">Deletar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow><TableCell colSpan="10" className="text-center text-gray-400 py-10">Nenhum lançamento encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
                {entries.length > 0 && (
                  <TableFooter>
                    <TableRow className="bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm hidden md:table-row">
                      <TableCell colSpan={5} className="p-2">TOTAIS DO PERÍODO</TableCell>
                      <TableCell className="text-right p-2">{formatCurrency(summary.total_value)}</TableCell>
                      <TableCell className="text-right p-2">{formatCurrency(summary.total_paid)}</TableCell>
                      <TableCell className="text-right p-2">{formatCurrency(summary.total_balance)}</TableCell>
                      <TableCell colSpan={2} className="p-2"></TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            )}
            </div>
            {entries.length > 0 && !loading && (
              <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-0 rounded-b-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span>Valor Total (Período):</span>
                  <span>{formatCurrency(summary.total_value)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Total Pago (Período):</span>
                  <span>{formatCurrency(summary.total_paid)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Saldo Total (Período):</span>
                  <span>{formatCurrency(summary.total_balance)}</span>
                </div>
              </div>
            )}
        </div>

        {totalCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            totalCount={totalCount}
          />
        )}
      </div>
      {selectedEntry && (
        <PaymentDialog
            key={dialogKey}
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            entry={selectedEntry}
            onSuccess={() => {
                fetchEntries();
                fetchSummary();
            }}
        />
      )}
      {selectedEntry && (
        <PaymentHistoryDialog
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            entry={selectedEntry}
            onSuccess={() => {
                fetchEntries();
                fetchSummary();
            }}
        />
      )}
    </>
  );
};

export default ListaFinanceiro;