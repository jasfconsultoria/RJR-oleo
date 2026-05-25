import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
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
import { Button } from '@/components/ui/button';
import { Loader2, Edit, Trash2, FileText, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatNumber, cn, formatCnpjCpf } from '@/lib/utils';

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

// Function to get badge styling for collection type
const getTypeBadge = (type) => {
  switch (type) {
    case 'Compra':
      return 'bg-green-500/20 text-green-300';
    case 'Troca':
      return 'bg-blue-500/20 text-blue-300';
    case 'Doação':
      return 'bg-purple-500/20 text-purple-300';
    default:
      return 'bg-gray-500/20 text-gray-300';
  }
};

// Function to get badge styling and text for receipt status
const getStatusBadge = (coleta) => {
  // Verifica se tem assinatura
  const hasSignature = !!coleta.assinatura_url;
  
  if (hasSignature) {
    return { text: 'Finalizada', className: 'bg-green-500/20 text-green-300' };
  } else {
    return { text: 'Aguardando Assinatura', className: 'bg-blue-500/20 text-blue-300' };
  }
};

// Function to format client name display
const formatClienteDisplay = (coleta) => {
  const nomeFantasia = coleta.nome_fantasia || '';
  const razaoSocial = coleta.razao_social || '';
  
  if (nomeFantasia && razaoSocial) {
    return `${nomeFantasia} - ${razaoSocial}`;
  }
  return nomeFantasia || razaoSocial || '';
};

const ColetasTable = ({
  coletas,
  sortConfig,
  requestSort,
  handleOpenRecibo,
  handleDelete,
  handleCollectorDeleteAttempt,
  handleReviewDeleteRequest,
  totals,
  loading,
  userRole,
  reviewSubmittingId,
}) => {
  const navigate = useNavigate();
  const [selectedReviewDecision, setSelectedReviewDecision] = useState('approved');
  const isCollector = userRole === 'coletor';
  const canReviewDelete = ['administrador', 'gerente', 'super_admin'].includes(userRole);

  const formatColetaDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
      console.error("Error formatting date:", e);
      return 'Data inválida';
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : (
        <Table className="responsive-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
              <TableHeaderSortable columnKey="numero_coleta" label="Nº Coleta" sortConfig={sortConfig} onSort={requestSort} className="w-[10%]" />
              <TableHeaderSortable columnKey="data_coleta" label="Data" sortConfig={sortConfig} onSort={requestSort} className="w-[12%]" />
              <TableHeaderSortable columnKey="razao_social" label="Cliente" sortConfig={sortConfig} onSort={requestSort} className="w-[25%]" />
              <TableHeaderSortable columnKey="tipo_coleta" label="Tipo" sortConfig={sortConfig} onSort={requestSort} className="w-[10%]" />
              <TableHeaderSortable columnKey="quantidade_coletada" label="Qtd. Coletada (kg)" sortConfig={sortConfig} onSort={requestSort} className="w-[13%]" />
              <TableHead className="text-emerald-300 w-[15%]">Valor/Entregue (R$/Unidade)</TableHead>
              <TableHeaderSortable columnKey="status_recibo" label="Status" sortConfig={sortConfig} onSort={requestSort} className="w-[10%]" />
              <TableHead className="text-emerald-300 text-right w-[5%]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coletas.length > 0 ? (
              coletas.map((coleta) => {
                const statusInfo = getStatusBadge(coleta);
                const isCompra = coleta.tipo_coleta === 'Compra';
                const isDeletePending = coleta.delete_request_status === 'pending';
                const isReviewSubmitting = reviewSubmittingId?.startsWith(`${coleta.delete_request_id}-`);
                const valueOrDelivered = isCompra
                  ? formatCurrency(coleta.total_pago || 0)
                  : `${formatNumber(coleta.quantidade_entregue || 0)} Unidades`;

                return (
                  <TableRow key={coleta.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                    <TableCell data-label="Nº Coleta" className="font-mono">{String(coleta.numero_coleta).padStart(6, '0')}</TableCell>
                    <TableCell data-label="Data">{formatColetaDate(coleta.data_coleta)}</TableCell>
                    <TableCell data-label="Cliente">
                      <div className="font-semibold drop-shadow-sm">{coleta.cliente_display || formatClienteDisplay(coleta)}</div>
                      {coleta.cliente_cnpj_cpf && <div className="text-xs text-white/50">{formatCnpjCpf(coleta.cliente_cnpj_cpf)}</div>}
                    </TableCell>
                    <TableCell data-label="Tipo">
                      <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getTypeBadge(coleta.tipo_coleta)}`}>
                        {coleta.tipo_coleta}
                      </span>
                    </TableCell>
                    <TableCell data-label="Qtd. Coletada (kg)">{formatNumber(coleta.quantidade_coletada)}</TableCell>
                    <TableCell data-label="Valor/Entregue">{valueOrDelivered}</TableCell>
                    <TableCell data-label="Status">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${statusInfo.className}`}>
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
                    <TableCell className="text-right actions-cell">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenRecibo(coleta.id)}
                          title="Ver Recibo"
                          className="text-blue-400 hover:text-blue-300 rounded-xl"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/app/coletas/editar/${coleta.id}`)}
                          title="Editar Coleta"
                          className="text-yellow-400 hover:text-yellow-300 rounded-xl"
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
                                  Coleta Nº {String(coleta.numero_coleta).padStart(6, '0')}. Motivo informado: {coleta.delete_request_motivo || 'Não informado'}.
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
                                  onClick={() => handleReviewDeleteRequest(coleta, selectedReviewDecision)}
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
                                title="Excluir Coleta"
                                onClick={() => {
                                  if (isCollector) {
                                    handleCollectorDeleteAttempt?.(coleta);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>{isCollector ? 'Deseja realmente excluir essa coleta ?' : 'Você tem certeza?'}</AlertDialogTitle>
                                <AlertDialogDescription className="text-emerald-300">
                                  {isCollector
                                    ? `Ao confirmar, você deverá informar o motivo. A coleta Nº ${String(coleta.numero_coleta).padStart(6, '0')} ficará pendente para aprovação do Administrador.`
                                    : `Esta ação não pode ser desfeita. Isso deletará permanentemente a coleta Nº ${String(coleta.numero_coleta).padStart(6, '0')}, bem como todos os lançamentos financeiros e movimentações de estoque associados.`
                                  }
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(coleta.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
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
                <TableCell colSpan={8} className="text-center text-gray-400 py-10">
                  Nenhuma coleta encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {coletas.length > 0 && (
            <TableFooter>
              <TableRow className="bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm hidden md:table-row">
                <TableCell colSpan={4} className="p-2">TOTAIS DO PERÍODO</TableCell>
                <TableCell className="p-2">{formatNumber(totals.coletado)} kg</TableCell>
                <TableCell className="p-2">
                  {formatCurrency(totals.compras)} / {formatNumber(totals.entregue)} Unidades
                </TableCell>
                <TableCell colSpan={2} className="p-2"></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      )}
      {coletas.length > 0 && !loading && (
        <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-0 rounded-b-xl space-y-2">
          <div className="flex justify-between items-center">
            <span>Total Coletado:</span>
            <span>{formatNumber(totals.coletado)} kg</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Compras / Entregue:</span>
            <span>{formatCurrency(totals.compras)} / {formatNumber(totals.entregue)} Unidades</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColetasTable;