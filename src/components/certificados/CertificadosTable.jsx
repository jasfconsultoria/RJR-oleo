import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { Loader2, Edit, Trash2, FileText, Share2, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatNumber, cn, formatDateWithTimezone } from '@/lib/utils';

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

const CertificadosTable = ({
  certificados,
  sortConfig,
  requestSort,
  handleOpenPdf,
  handleShare,
  handleEdit,
  handleDelete,
  handleOpenViewModal,
  timezone,
  loading,
}) => {
  const navigate = useNavigate();

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
              <TableHeaderSortable columnKey="id" label="ID" sortConfig={sortConfig} onSort={requestSort} className="w-[10%]" />
              <TableHeaderSortable columnKey="cliente_nome" label="Cliente" sortConfig={sortConfig} onSort={requestSort} className="w-[25%]" />
              <TableHeaderSortable columnKey="periodo_inicio" label="Período Início" sortConfig={sortConfig} onSort={requestSort} className="w-[15%]" />
              <TableHeaderSortable columnKey="periodo_fim" label="Período Fim" sortConfig={sortConfig} onSort={requestSort} className="w-[15%]" />
              <TableHeaderSortable columnKey="total_kg" label="Total (kg)" sortConfig={sortConfig} onSort={requestSort} className="w-[15%] text-right" />
              <TableHeaderSortable columnKey="data_emissao" label="Emissão" sortConfig={sortConfig} onSort={requestSort} className="w-[15%]" />
              <TableHead className="text-emerald-300 text-right w-[5%]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificados.length > 0 ? (
              certificados.map((cert) => (
                <TableRow key={cert.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                  <TableCell data-label="ID">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenViewModal(cert)}
                      title="Visualizar Certificado"
                      className="text-blue-400 hover:text-blue-300 p-0 h-auto font-mono font-bold"
                    >
                      #{cert.id}
                    </Button>
                  </TableCell>
                  <TableCell data-label="Cliente">
                    {cert.cliente_display || 
                     (cert.cliente?.nome_fantasia && cert.cliente?.razao_social 
                      ? `${cert.cliente.nome_fantasia} - ${cert.cliente.razao_social}`
                      : cert.cliente?.nome_fantasia || cert.cliente?.razao_social || 'N/A')}
                  </TableCell>
                  <TableCell data-label="Período Início">{formatDateWithTimezone(cert.periodo_inicio, timezone)}</TableCell>
                  <TableCell data-label="Período Fim">{formatDateWithTimezone(cert.periodo_fim, timezone)}</TableCell>
                  <TableCell data-label="Total (kg)" className="text-right">{formatNumber(cert.total_kg)}</TableCell>
                  <TableCell data-label="Emissão">{formatDateWithTimezone(cert.data_emissao, timezone)}</TableCell>
                  <TableCell className="text-right actions-cell">
                    <div className="flex justify-end items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenPdf(cert)}
                        title="Abrir PDF"
                        className="text-green-400 hover:text-green-300 rounded-xl"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleShare(cert)}
                        title="Compartilhar Certificado"
                        className="text-purple-400 hover:text-purple-300 rounded-xl"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(cert)}
                        title="Editar Certificado"
                        className="text-yellow-400 hover:text-yellow-300 rounded-xl"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 rounded-xl"
                            title="Excluir Certificado"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription className="text-emerald-300">
                              Esta ação não pode ser desfeita. Isso deletará permanentemente o certificado.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(cert.id)} className="bg-red-500 hover:bg-red-600 rounded-xl">
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
                <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  Nenhum certificado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default CertificadosTable;