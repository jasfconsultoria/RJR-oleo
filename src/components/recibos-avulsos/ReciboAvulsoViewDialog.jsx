import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ReciboAvulso } from '@/components/recibos/ReciboAvulso';
import { Share2, Printer, ArrowLeft, Eraser, CheckCircle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';

export const ReciboAvulsoViewDialog = ({
  recibo,
  empresa,
  isOpen,
  onClose,
  empresaTimezone
}) => {
  const { toast } = useToast();
  const reciboRef = useRef();
  const sigCanvas = useRef({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSigned = !!recibo.assinatura_url;

  const handleShare = async () => {
    if (!recibo) return;

    const link = isSigned
      ? `${window.location.origin}/recibo-avulso/publico/${recibo.id}`
      : `${window.location.origin}/assinatura/recibo-avulso/${recibo.id}`;

    const pessoaNome = recibo.pessoa_nome || 'o destinatário';

    const shareData = {
      title: isSigned
        ? `Recibo Avulso Nº ${recibo.numero_recibo}`
        : `Assinatura do Recibo Nº ${recibo.numero_recibo}`,
      text: isSigned
        ? `Segue recibo assinado para ${pessoaNome}.`
        : `Olá! Por favor, assine o recibo para ${pessoaNome}.`,
      url: link,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(link);
        toast({
          title: "Link Copiado!",
          description: "O link foi copiado para a área de transferência."
        });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast({
          title: "Erro ao compartilhar",
          description: "Não foi possível compartilhar o link.",
          variant: "destructive"
        });
      }
    }
  };

  const handlePrint = async () => {
    const input = reciboRef.current;
    if (!input) {
      toast({ title: 'Erro ao imprimir', description: 'Referência do recibo não encontrada.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });

    try {
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Largura fixa para garantir renderização correta
        onclone: (clonedDoc) => {
          // Remove a escala e ajustes de layout da visualização no clone usado para o PDF
          const scalingContainer = clonedDoc.getElementById('recibo-scaling-container');
          if (scalingContainer) {
            scalingContainer.style.transform = 'none';
            scalingContainer.style.width = '100%';
            scalingContainer.style.margin = '0';
            scalingContainer.style.padding = '20px';
          }

          const clonedElement = clonedDoc.querySelector('[data-html2canvas-ignore="true"]');
          if (clonedElement) {
            clonedElement.remove();
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      const margin = 20;
      const availableWidth = pdfWidth - (2 * margin);
      const availableHeight = pdfHeight - (2 * margin);

      const widthRatio = availableWidth / imgWidth;
      const heightRatio = availableHeight / imgHeight;
      const ratio = Math.min(widthRatio, heightRatio, 0.15);

      // FORÇAR REDUÇÃO: O recibo deve ocupar apenas 45% da largura da página A4
      const scaledWidth = pdfWidth * 0.45;
      const scaledHeight = (imgHeight * scaledWidth) / imgWidth;

      const x = (pdfWidth - scaledWidth) / 2;
      const y = 20; // Margem superior fixa

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);

      pdf.setProperties({
        title: `Recibo_Avulso_${recibo.numero_recibo?.toString().padStart(6, '0')}`
      });

      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Recibo_Avulso_${recibo.numero_recibo?.toString().padStart(6, '0')}.pdf`;
      link.target = '_blank';
      link.click();

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Ocorreu um problema ao tentar imprimir o recibo.',
        variant: "destructive"
      });
    }
  };

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleSaveSignature = async () => {
    if (sigCanvas.current.isEmpty()) {
      toast({ title: 'Assinatura em branco', description: 'Por favor, assine no campo indicado.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    try {
      const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const signatureBlob = await (await fetch(signatureDataUrl)).blob();
      const signatureFileName = `signatures/recibo-avulso-${recibo.id}-${Date.now()}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recibos')
        .upload(signatureFileName, signatureBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('recibos').getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('recibos_avulso')
        .update({ assinatura_url: publicUrl })
        .eq('id', recibo.id);

      if (updateError) throw updateError;

      toast({ title: 'Recibo assinado com sucesso!' });
      onClose();

    } catch (err) {
      console.error('❌ Erro ao salvar assinatura:', err);
      toast({ title: 'Erro ao salvar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-2xl h-[90vh] bg-gray-800 border-gray-700 text-white flex flex-col"
        aria-describedby="recibo-avulso-description"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Visualizar Recibo - {recibo.numero_recibo?.toString().padStart(6, '0')}</DialogTitle>
          <DialogDescription id="recibo-avulso-description" className="sr-only">
            Visualização e assinatura do recibo avulso {recibo.numero_recibo}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-2 bg-white rounded-md overflow-x-hidden">
          <div id="recibo-scaling-container" className="origin-top scale-[0.8] w-[125%] -ml-[12.5%] -mb-[20%] pointer-events-auto">
            <ReciboAvulso
              ref={reciboRef}
              data={recibo}
              empresa={empresa}
              signature={recibo.assinatura_url}
              timezone={empresaTimezone || empresa?.timezone || 'America/Sao_Paulo'}
              hideHeader={true}
            />
          </div>
          {!isSigned && (
            <div className="mt-2 p-4 border-t-2 border-dashed max-w-2xl mx-auto">
              <Label htmlFor="signature-canvas-modal" className="text-sm font-semibold mb-2 block text-gray-800">
                Assinatura:
              </Label>
              <div className="bg-gray-100 rounded-md p-1 border-2 border-dashed border-emerald-400">
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor='black'
                  canvasProps={{
                    id: 'signature-canvas-modal',
                    className: 'w-full h-32 rounded-md',
                    willReadFrequently: true
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="mt-4 flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={onClose} className="border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black">
            <ArrowLeft className="mr-2 h-4 w-4" /> {isSigned ? 'Fechar' : 'Voltar'}
          </Button>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleShare} className="bg-blue-500 hover:bg-blue-600">
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar
            </Button>
            <Button onClick={handlePrint} className="bg-emerald-500 hover:bg-emerald-600">
              <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            {!isSigned && (
              <>
                <Button variant="outline" onClick={clearSignature} className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black">
                  <Eraser className="mr-2 h-4 w-4" /> Limpar
                </Button>
                <Button onClick={handleSaveSignature} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Salvar Assinatura
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
