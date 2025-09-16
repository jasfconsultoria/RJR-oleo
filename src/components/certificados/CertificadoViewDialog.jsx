import React, { useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Share2, Loader2 } from 'lucide-react';
import CertificadoPDF from '@/components/CertificadoPDF';

export const CertificadoViewDialog = ({ certificado, open, onOpenChange }) => {
  const certificadoPdfRef = useRef();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndProcessPdf = async (action) => {
    const input = certificadoPdfRef.current;
    if (!input) {
      toast({ title: 'Erro', description: 'Referência do certificado não encontrada.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    
    try {
      const canvas = await html2canvas(input, { 
        scale: 3, // Aumenta a escala para melhor qualidade
        useCORS: true,
        allowTaint: true
      });
      const imgData = canvas.toDataURL('image/png');
      
      // 'l' para orientação paisagem (landscape), como solicitado
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Lógica do contrato: calcula a proporção para ajustar a imagem na página
      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      
      const imgWidth = canvasWidth * ratio;
      const imgHeight = canvasHeight * ratio;

      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      if (action === 'print') {
        // Lógica do contrato: download direto do arquivo
        pdf.save(`Certificado_${certificado.cliente.nome}.pdf`);
      } else if (action === 'share') {
        // Correção definitiva: usa pdf.output('blob') para compartilhar
        const pdfBlob = pdf.output('blob');
        const file = new File([pdfBlob], `Certificado_${certificado.cliente.nome}.pdf`, { type: 'application/pdf' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Certificado de Coleta - ${certificado.cliente.nome}`,
          });
        } else {
          toast({ title: 'Compartilhamento não suportado', description: 'Seu navegador não suporta o compartilhamento de arquivos. Tente imprimir e salvar como PDF.', variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Houve um problema ao criar o documento. Verifique o console para mais detalhes.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
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
              <Button onClick={() => generateAndProcessPdf('share')} variant="outline" className="text-white hover:bg-white/10 border-white/30" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                Compartilhar
              </Button>
              <Button onClick={() => generateAndProcessPdf('print')} variant="outline" className="text-white hover:bg-white/10 border-white/30" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Imprimir / Salvar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};