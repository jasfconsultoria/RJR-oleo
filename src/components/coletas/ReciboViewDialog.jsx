import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Recibo } from '@/components/Recibo';
import { Share2, Printer, ArrowLeft, Eraser, CheckCircle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';
import PaymentDialog from '@/components/financeiro/PaymentDialog'; // Importar o PaymentDialog

export const ReciboViewDialog = ({ coleta, empresa, isOpen, onClose, empresaTimezone }) => {
  const { toast } = useToast();
  const reciboRef = useRef();
  const sigCanvas = useRef({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collectorName, setCollectorName] = useState(null);

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [debitEntryForPayment, setDebitEntryForPayment] = useState(null);

  const isSigned = !!coleta.assinatura_url;

  const fetchCollectorName = useCallback(async () => {
    if (coleta?.user_id) {
      const { data, error } = await supabase.rpc('get_all_users');
      if (error) {
        console.error('Erro ao buscar usuários para nome do coletor:', error);
      } else {
        const collector = data.find(u => u.id === coleta.user_id);
        setCollectorName(collector?.full_name || collector?.email || 'N/A');
      }
    }
  }, [coleta?.user_id]);

  useEffect(() => {
    if (isOpen && coleta) {
      fetchCollectorName();
      console.log('ReciboViewDialog - Coleta prop recebida:', coleta);
      console.log('ReciboViewDialog - coleta.hora_coleta:', coleta.hora_coleta);
    }
  }, [isOpen, coleta, fetchCollectorName]);

  const handleShare = async () => {
    if (!coleta) return;

    const link = isSigned
      ? `${window.location.origin}/recibo/publico/${coleta.id}`
      : `${window.location.origin}/assinatura/recibo/${coleta.id}`;
    
    const shareData = {
      title: isSigned ? `Recibo de Coleta Nº ${coleta.numero_coleta}` : `Assinatura do Recibo Nº ${coleta.numero_coleta}`,
      text: `Olá! Por favor, assine o recibo da coleta para ${coleta.pessoa?.nome || coleta.cliente_nome}.`,
      url: link,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(link);
        toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
      }
    } catch (error) {
      toast({ title: "Erro ao compartilhar", description: "Não foi possível compartilhar o link.", variant: "destructive" });
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
      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const pdfBlob = pdf.getBlob();
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: 'Erro ao gerar PDF', description: 'Ocorreu um problema ao tentar imprimir o recibo.', variant: "destructive" });
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
      const signatureFileName = `signatures/recibo-${coleta.id}-${Date.now()}.png`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recibos')
        .upload(signatureFileName, signatureBlob, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('recibos').getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;

      const { error: upsertError } = await supabase
        .from('recibos')
        .upsert({
          coleta_id: coleta.id,
          assinatura_url: publicUrl,
        }, { onConflict: 'coleta_id' });

      if (upsertError) throw upsertError;
        
      toast({ title: 'Recibo assinado com sucesso!' });
      
      if (coleta.tipo_coleta === 'Compra') {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Aumentado para 3 segundos

        console.log('ReciboViewDialog: Tentando buscar lançamento de débito para coleta_id:', coleta.id);
        const { data: debitEntry, error: debitError } = await supabase
          .from('v_financeiro_completo')
          .select('*')
          .eq('lancamento_id', coleta.id)
          .eq('type', 'debito')
          .maybeSingle(); // Alterado para maybeSingle()

        console.log('ReciboViewDialog: Resultado da busca do débito:', { debitEntry, debitError });

        if (debitError) {
          console.error('ReciboViewDialog: Erro ao buscar lançamento de débito:', debitError);
          toast({ title: 'Erro', description: `Não foi possível carregar os detalhes do débito para pagamento: ${debitError.message}. Por favor, registre o pagamento manualmente na seção Financeiro.`, variant: 'destructive', duration: 8000 });
          onClose();
        } else if (!debitEntry) {
          console.warn('ReciboViewDialog: Lançamento de débito não encontrado após assinatura para coleta_id:', coleta.id);
          toast({ title: 'Aviso', description: 'Lançamento de débito não encontrado. Por favor, registre o pagamento manualmente na seção Financeiro.', variant: 'warning', duration: 8000 });
          onClose();
        }
        else {
          console.log('ReciboViewDialog: Lançamento de débito encontrado:', debitEntry);
          setDebitEntryForPayment(debitEntry);
          setShowPaymentDialog(true);
        }
      } else {
        onClose();
      }

    } catch (err) {
      toast({ title: 'Erro ao salvar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    onClose();
  };

  const handlePaymentClose = () => {
    setShowPaymentDialog(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl h-[90vh] bg-gray-800 border-gray-700 text-white flex flex-col">
          <DialogHeader>
            <DialogTitle>Visualizar Recibo - {coleta.numero_coleta}</DialogTitle>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto p-4 bg-white rounded-md">
            <Recibo 
              ref={reciboRef} 
              data={coleta} 
              empresa={empresa} 
              signature={coleta.assinatura_url} 
              timezone={empresaTimezone} 
              collectorName={collectorName} 
              coletaDateString={coleta.data_coleta}
              coletaTimeString={coleta.hora_coleta}
            />
            {!isSigned && (
              <div className="mt-6 p-4 border-t-2 border-dashed">
                <Label htmlFor="signature-canvas-modal" className="text-lg font-semibold mb-2 block text-gray-800">Assinatura:</Label>
                <div className="bg-gray-100 rounded-md p-1 border-2 border-dashed border-emerald-400">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor='black'
                    canvasProps={{ id: 'signature-canvas-modal', className: 'w-full h-48 rounded-md' }}
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

      {debitEntryForPayment && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={handlePaymentClose}
          entry={debitEntryForPayment}
          onSuccess={handlePaymentSuccess}
          initialPaidAmount={debitEntryForPayment.amount_balance}
          initialPaymentMethod="pix"
        />
      )}
    </>
  );
};