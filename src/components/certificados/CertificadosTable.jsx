import React from 'react';
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
import { Loader2, FileText, Share2, Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { formatNumber, formatDateWithTimezone } from '@/lib/utils'; // Importar formatDateWithTimezone

export const CertificadosTable = ({
  loading,
  certificados,
  sortConfig,
  requestSort,
  handleOpenPdf,
  handleShare,
  handleEdit,
  handleDelete,
  timezone, // Adicionado prop timezone
}) => {
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <Table className="responsive-table">
        <TableHeader>
          <TableRow className="hover:bg-white/10 border-b border-white/20 text-xs">
            <th className="p-2 text-left text-white">ID</th>
            <th onClick={() => requestSort('data_emissao')} className="cursor-pointer text-white p-2 text-left">
              <div className="flex items-center">Data Emissão {getSortIcon('data_emissao')}</div>
            </th>
            <th onClick={() => requestSort('cliente_nome')} className="cursor-pointer text-white p-2 text-left">
              <div className="flex items-center">Cliente {getSortIcon('cliente_nome')}</div>
            </th>
            <th className="p-2 text-left text-white">Período</th>
            <th onClick={() => requestSort('total_kg')} className="cursor-pointer text-white p-2 text-right">
              <div className="flex items-center justify-end">Total (kg) {getSortIcon('total_kg')}</div>
            </th>
            <th className="text-right text-white p-2">Ações</th>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certificados.length > 0 ? certificados.map((cert) => (
            <TableRow key={cert.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
              <TableCell data-label="ID" className="p-2 font-mono">{cert.id.substring(0, 8)}</TableCell> {/* Removido text-xs */}
              <TableCell data-label="Data Emissão" className="p-2">{formatDateWithTimezone(cert.data_emissao, timezone)}</TableCell> {/* Usando formatDateWithTimezone */}
              <TableCell data-label="Cliente" className="font-medium p-2">{cert.cliente_nome_fantasia ? `${cert.cliente_nome_razao} - ${cert.cliente_nome_fantasia}` : cert.cliente_nome_razao}</TableCell>
              <TableCell data-label="Período" className="p-2">{formatDateWithTimezone(cert.periodo_inicio, timezone)} - {formatDateWithTimezone(cert.periodo_fim, timezone)}</TableCell>
              <TableCell data-label="Total (kg)" className="text-right p-2">{formatNumber(cert.total_kg)}</TableCell>
              <TableCell className="p-2 actions-cell text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenPdf(cert)} title="Abrir PDF">
                    <FileText className="h-4 w-4 text-blue-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleShare(cert)} title="Compartilhar">
                    <Share2 className="h-4 w-4 text-green-400" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(cert)} title="Editar/Visualizar">
                    <Edit className="h-4 w-4 text-yellow-400" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Excluir">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription className="text-emerald-300">
                          Esta ação não pode ser desfeita. Isso excluirá permanentemente o certificado.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button variant="outline" className="border-white/50 text-white hover:bg-white/20 rounded-xl">Cancelar</Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button onClick={() => handleDelete(cert.id)} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Excluir</Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-white/70">
                Nenhum certificado encontrado para os filtros selecionados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};