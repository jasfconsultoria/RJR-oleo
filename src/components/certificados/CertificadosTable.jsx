import React from 'react';
import { motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { CertificadoActions } from './CertificadoActions';

export const CertificadosTable = ({ loading, certificados, sortConfig, requestSort, handleView, handleDelete }) => {
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 bg-white/10 backdrop-blur-sm rounded-xl">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
      <div className="overflow-x-auto rounded-lg">
        <Table className="responsive-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
              <th onClick={() => requestSort('data_emissao')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Data Emissão {getSortIcon('data_emissao')}</div>
              </th>
              <th onClick={() => requestSort('cliente_nome')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Cliente {getSortIcon('cliente_nome')}</div>
              </th>
              <th onClick={() => requestSort('periodo_inicio')} className="cursor-pointer text-white p-2 text-left">
                <div className="flex items-center">Período {getSortIcon('periodo_inicio')}</div>
              </th>
              <th className="text-right text-white p-2">Total (kg)</th>
              <th className="text-left text-white p-2">Ações</th>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificados.length > 0 ? certificados.map((cert) => (
              <TableRow key={cert.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                <TableCell data-label="Data Emissão" className="p-2">{new Date(cert.data_emissao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                <TableCell data-label="Cliente" className="font-medium p-2">{cert.cliente_nome}</TableCell>
                <TableCell data-label="Período" className="p-2">{new Date(cert.periodo_inicio + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - {new Date(cert.periodo_fim + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                <TableCell data-label="Total (kg)" className="text-right p-2">{parseFloat(cert.total_kg).toFixed(2)}</TableCell>
                <TableCell className="p-2 actions-cell">
                  <CertificadoActions 
                    onView={() => handleView(cert)}
                    onDelete={() => handleDelete(cert.id)}
                  />
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-white/70">
                  Nenhum certificado encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};