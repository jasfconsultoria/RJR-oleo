import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { FileDown, PlusCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/ui/use-toast';

export const CertificadosHeader = ({ certificados, startDate, endDate }) => {
  const { toast } = useToast();

  const handleExportExcel = () => {
    if (certificados.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Filtre os dados que deseja exportar.',
        variant: 'destructive',
      });
      return;
    }

    const dataToExport = certificados.map(cert => ({
      'Data Emissão': new Date(cert.data_emissao).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
      'Cliente': cert.cliente_nome,
      'Período': `${new Date(cert.periodo_inicio + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })} - ${new Date(cert.periodo_fim + 'T00:00:00').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`,
      'Total Coletado (kg)': cert.total_kg.toFixed(2),
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Certificados');
    XLSX.writeFile(workbook, `Certificados_${startDate}_a_${endDate}.xlsx`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-400" /> Lista de Certificados
        </h1>
        <p className="text-emerald-200/80 mt-1">Visualize e gerencie os certificados gerados.</p>
      </div>
      <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
        <Button onClick={handleExportExcel} variant="outline" className="w-full sm:w-auto">
          <FileDown className="mr-2 h-4 w-4" />
          Exportar
        </Button>
        <Link to="/app/certificados/novo" className='w-full sm:w-auto'>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Certificado
          </Button>
        </Link>
      </div>
    </motion.div>
  );
};