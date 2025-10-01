import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Edit, Trash2, FileText, ChevronUp, ChevronDown, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatNumber, formatCurrency, formatDateWithTimezone } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ColetasTable = ({ coletas, sortConfig, requestSort, handleOpenRecibo, handleDelete, totals, timezone }) => {
  const navigate = useNavigate();

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Assinado': // Valor do banco de dados
        return 'bg-green-500/20 text-green-300'; // Estilo para 'Finalizada'
      case 'Aguardando Assinatura':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'Não Gerado':
        return 'bg-gray-500/20 text-gray-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-xl">
        <Table className="responsive-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
              <th onClick={() => requestSort('numero_coleta')} className="cursor-pointer p-2 text-left text-white">
                <div className="flex items-center">Nº Coleta {getSortIcon('numero_coleta')}</div>
              </th>
              <th onClick={() => requestSort('data_coleta')} className="cursor-pointer p-2 text-left text-white">
                <div className="flex items-center">Data {getSortIcon('data_coleta')}</div>
              </th>
              <th onClick={() => requestSort('cliente_nome')} className="cursor-pointer p-2 text-left text-white">
                <div className="flex items-center">Cliente {getSortIcon('cliente_nome')}</div>
              </th>
              <th onClick={() => requestSort('tipo_coleta')} className="cursor-pointer p-2 text-left text-white">
                <div className="flex items-center">Tipo {getSortIcon('tipo_coleta')}</div>
              </th>
              <th onClick={() => requestSort('quantidade_coletada')} className="cursor-pointer p-2 text-right text-white">
                <div className="flex items-center justify-end">Qtd. Coletada (kg) {getSortIcon('quantidade_coletada')}</div>
              </th>
              <th className="p-2 text-right text-white">Valor/Entregue (R$/Unidade)</th>
              <th className="p-2 text-center text-white">Status</th>
              {/* Ajuste: Alinhamento do título da coluna "Ações" para a esquerda */}
              <th className="p-2 text-left text-white">Ações</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coletas.length > 0 ? (
              coletas.map((coleta) => (
                <TableRow key={coleta.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                  <TableCell data-label="Nº Coleta" className="font-mono">{String(coleta.numero_coleta).padStart(6, '0')}</TableCell>
                  <TableCell data-label="Data">{formatDateWithTimezone(coleta.data_coleta, timezone)}</TableCell>
                  <TableCell data-label="Cliente">{coleta.cliente_nome_fantasia ? `${coleta.cliente_nome} - ${coleta.cliente_nome_fantasia}` : coleta.cliente_nome}</TableCell>
                  {/* A coluna "Tipo" já está com 'capitalize', que é o estilo solicitado */}
                  <TableCell data-label="Tipo" className="capitalize">{coleta.tipo_coleta}</TableCell>
                  <TableCell data-label="Qtd. Coletada (kg)" className="text-right">{formatNumber(coleta.quantidade_coletada)}</TableCell>
                  <TableCell data-label="Valor/Entregue" className="text-right">
                    {coleta.tipo_coleta === 'Compra' ? formatCurrency(coleta.total_pago) : `${formatNumber(coleta.quantidade_entregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades`}
                  </TableCell>
                  <TableCell data-label="Status" className="text-center">
                    <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getStatusBadge(coleta.status_recibo)}`}>
                      {/* Ajuste: Exibir 'Finalizada' se o status do DB for 'Assinado' */}
                      {coleta.status_recibo === 'Assinado' ? 'Finalizada' : coleta.status_recibo}
                    </span>
                  </TableCell>
                  <TableCell className="text-right actions-cell">
                    <div className="flex justify-end items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/app/coletas/editar/${coleta.id}`)}
                        className="text-yellow-400 hover:text-yellow-300 rounded-xl"
                        title="Editar Coleta"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenRecibo(coleta.id)}
                        className="text-blue-400 hover:text-blue-300 rounded-xl"
                        title="Visualizar Recibo"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 rounded-xl"
                            title="Excluir Coleta"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription className="text-emerald-300">
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente a coleta,
                              incluindo todos os lançamentos financeiros e de estoque relacionados a ela.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(coleta.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan="8" className="text-center text-gray-400 py-10">
                  Nenhuma coleta encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm hidden md:table-row">
              <TableCell colSpan={4} className="p-2">TOTAIS DO PERÍODO</TableCell>
              <TableCell className="text-right p-2">{formatNumber(totals.coletado)} kg</TableCell>
              <TableCell className="text-right p-2">
                {formatCurrency(totals.compras)} / {formatNumber(totals.entregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades
              </TableCell>
              <TableCell colSpan={2} className="p-2"></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-0 rounded-b-xl space-y-2">
        <div className="flex justify-between items-center">
          <span>Total Coletado (Período):</span>
          <span>{formatNumber(totals.coletado)} kg</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Total Pago/Entregue (Período):</span>
          <span>{formatCurrency(totals.compras)} / {formatNumber(totals.entregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades</span>
        </div>
      </div>
    </>
  );
};

export default ColetasTable;