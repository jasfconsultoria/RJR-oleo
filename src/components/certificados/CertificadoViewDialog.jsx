import React, { useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import CertificadoPDF from '@/components/CertificadoPDF';

export const CertificadoViewDialog = ({ certificado, onOpenChange }) => {
  const certificadoPdfRef = useRef();
  const { toast } = useToast();

  const generatePdfBlob = async () => {
    const input = certificadoPdfRef.current;
    if (!input) return null;
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    return pdf.getBlob();
  };

  const handleShare = async () => {
    const pdfBlob = await generatePdfBlob();
    if (!pdfBlob) return;
    const file = new File([pdfBlob], `certificado_${certificado.cliente.nome}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Certificado para ${certificado.cliente.nome}`,
      });
    } else {
      toast({ title: 'Compartilhamento não suportado', variant: 'destructive' });
    }
  };

  const handlePrint = async () => {
    const pdfBlob = await generatePdfBlob();
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  };

  return (
    <Dialog open={!!certificado} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-white/10 border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-emerald-300">Visualizar Certificado</DialogTitle>
        </DialogHeader>
        {certificado && (
          <>
            <div className="flex-grow overflow-auto p-2 bg-gray-800 rounded-md">
              <div ref={certificadoPdfRef}>
                <CertificadoPDF data={certificado} />
              </div>
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button onClick={handleShare} variant="outline" className="text-white hover:bg-white/10 border-white/30"><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button>
              <Button onClick={handlePrint} variant="outline" className="text-white hover:bg-white/10 border-white/30"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};