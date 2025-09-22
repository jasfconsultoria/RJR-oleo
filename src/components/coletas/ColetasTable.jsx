import React from 'react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { ChevronDown, ChevronUp, Edit, Trash2, Receipt } from 'lucide-react';
import { formatCurrency, formatNumber, formatDateWithTimezone } from '@/lib/utils'; // Alterado para formatDateWithTimezone


const ColetasTable = ({ coletas, sortConfig, requestSort, handleOpenRecibo, handleDelete, totals, timezone }) => {
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const getEntregueValor = (coleta) => {
    if (coleta.tipo_coleta === 'Compra') {
      return formatCurrency(coleta.total_pago);
    }
    if (coleta.tipo_coleta === 'Troca' || coleta.tipo_coleta === 'Doação') { // Adicionado Doação
      return `${formatNumber(coleta.quantidade_entregue, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Unidades`;
    }
    return 'N/A'; // Para outros tipos de coleta
  };

  const tipoColetaStyle = (tipo) => {
    switch (tipo) {
      case 'Troca':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'Compra':
        return 'bg-green-500/20 text-green-300 border border-green-500/30';
      case 'Doação': // Estilo para Doação
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border border-gray-500/30';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'assinado':
        return 'bg-green-500/20 text-green-300';
      case 'pendente_assinatura':
        return 'bg-blue-500/20 text-blue-300';
      case 'nao_gerado':
        return 'bg-yellow-500/20 text-yellow-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'assinado': return 'Finalizada';
      case 'pendente_assinatura': return 'Aguardando Assinatura';
      case 'nao_gerado': return 'Em Andamento';
      default: return status;
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl">
        <Table className="responsive-table">
          <TableHeader>
            <TableRow className="hover:bg-white/10 border-b border-white/20 text-xs">
              <th onClick={() => requestSort('numero_coleta')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Nº Coleta {getSortIcon('numero_coleta')}</div>
              </th>
              <th onClick={() => requestSort('data_coleta')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Data {getSortIcon('data_coleta')}</div>
              </th>
              <th onClick={() => requestSort('cliente_nome')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Cliente {getSortIcon('cliente_nome')}</div>
              </th>
              <th onClick={() => requestSort('tipo_coleta')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Tipo {getSortIcon('tipo_coleta')}</div>
              </th>
              <th onClick={() => requestSort('quantidade_coletada')} className="cursor-pointer text-white p-2 text-right">
                <div className="flex items-center justify-end">Qtd. Coletada (kg) {getSortIcon('quantidade_coletada')}</div>
              </th>
               <th className="text-white p-2 text-right">
                <div className="flex items-center justify-end">Valor/Entregue (R$/Unidade)</div> {/* Alterado para R$/Unidade */}
              </th>
              <th className="p-2 text-left text-white">Status</th> {/* Nova coluna de status */}
              <th className="text-left text-white p-2">Ações</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coletas.length > 0 ? coletas.map((coleta) => (
                <TableRow key={coleta.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                  <TableCell data-label="Nº Coleta" className="font-medium p-2">{coleta.numero_coleta?.toString().padStart(6, '0')}</TableCell>
                  <TableCell data-label="Data" className="p-2">{formatDateWithTimezone(coleta.data_coleta, timezone)}</TableCell>
                  <TableCell data-label="Cliente" className="p-2">{coleta.cliente_nome_fantasia ? `${coleta.cliente_nome} - ${coleta.cliente_nome_fantasia}` : coleta.cliente_nome}</TableCell>
                  <TableCell data-label="Tipo" className="p-2">
                    <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${tipoColetaStyle(coleta.tipo_coleta)}`}>
                      {coleta.tipo_coleta}
                    </span>
                  </TableCell>
                  <TableCell data-label="Qtd. Coletada (kg)" className="p-2 text-right">{formatNumber(coleta.quantidade_coletada)}</TableCell>
                  <TableCell data-label="Valor/Entregue (R$/Unidade)" className="p-2 text-right">{getEntregueValor(coleta)}</TableCell>
                  <TableCell data-label="Status" className="p-2"> {/* Nova célula de status */}
                    <span className={`px-2 py-1 rounded-xl text-xs font-semibold ${getStatusBadge(coleta.status_recibo)}`}>
                      {getStatusText(coleta.status_recibo)}
                    </span>
                  </TableCell>
                  <TableCell className="p-2 actions-cell">
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="icon" title="Ver Recibo" onClick={() => handleOpenRecibo(coleta.id)}>
                          <Receipt className="h-4 w-4 text-cyan-400" />
                        </Button>
                      <Link to={`/app/coletas/editar/${coleta.id}`}>
                        <Button variant="ghost" size="icon" title="Editar Coleta">
                          <Edit className="h-4 w-4 text-yellow-400" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Excluir Coleta">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription className="text-emerald-300">
                              Esta ação não pode ser desfeita. Isso excluirá permanentemente a coleta.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel asChild>
                              <Button variant="outline" className="border-white/50 text-white hover:bg-white/20 rounded-xl">Cancelar</Button>
                            </AlertDialogCancel>
                            <AlertDialogAction asChild>
                              <Button onClick={() => handleDelete(coleta.id)} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Excluir</Button>
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              )) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-white/70">
                  Nenhuma coleta encontrada para o período selecionado.
                </TableCell>
              </TableRow>
            )}
            <TableRow className="bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm hidden md:table-row">
              <TableCell colSpan={4} className="p-2">TOTAIS DO PERÍODO</TableCell>
              <TableCell className="text-right p-2">{formatNumber(totals.coletado)} kg</TableCell>
              <TableCell className="text-right p-2 whitespace-nowrap">
                {formatCurrency(totals.compras)} / {formatNumber(totals.entregue, {minimumFractionDigits: 0, maximumFractionDigits: 0})} Unidades {/* Alterado para Unidades */}
              </TableCell>
              <TableCell colSpan={2} className="p-2"></TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="md:hidden bg-black/20 font-bold text-white border-t-2 border-emerald-500 text-sm p-4 mt-4 rounded-b-xl space-y-2">
          <div className="flex justify-between items-center">
            <span>Total Coletado (Período):</span>
            <span>{formatNumber(totals.coletado)} kg</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Pago (Período):</span>
            <span>{formatCurrency(totals.compras)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Entregue (Período):</span>
            <span>{formatNumber(totals.entregue, {minimumFractionDigits: 0, maximumFractionDigits: 0})} Unidades</span> {/* Alterado para Unidades */}
          </div>
        </div>
    </div>
  );
};

export default ColetasTable;