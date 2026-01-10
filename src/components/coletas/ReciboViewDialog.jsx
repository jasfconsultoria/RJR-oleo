import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Recibo } from '@/components/recibos/Recibo';
import { Share2, Printer, ArrowLeft, Eraser, CheckCircle, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/customSupabaseClient';
import { Label } from '@/components/ui/label';
import PaymentDialog from '@/components/financeiro/PaymentDialog';

export const ReciboViewDialog = ({ 
  coleta, 
  empresa, 
  isOpen, 
  onClose, 
  empresaTimezone,
  showPaymentAfterSignature = true,
  isUserLoggedIn = true
}) => {
  const { toast } = useToast();
  const reciboRef = useRef();
  const sigCanvas = useRef({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collectorName, setCollectorName] = useState(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [debitEntryForPayment, setDebitEntryForPayment] = useState(null);

  const isSigned = !!coleta.assinatura_url;

  // DEBUG: Verificar se os dados da empresa estão chegando
  useEffect(() => {
    if (isOpen && empresa) {
      console.log('🏢 DEBUG - Dados da empresa recebidos COMPLETOS:', empresa);
      console.log('🏢 DEBUG - Todos os campos:', Object.keys(empresa));
      console.log('🏢 DEBUG - municipio:', empresa.municipio);
      console.log('🏢 DEBUG - estado:', empresa.estado);
      console.log('📄 DEBUG - Dados da coleta recebidos:', coleta);
    }
  }, [isOpen, empresa, coleta]);

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
    }
  }, [isOpen, coleta, fetchCollectorName]);

  const handleShare = async () => {
    if (!coleta) return;

    const link = isSigned
      ? `${window.location.origin}/recibo/publico/${coleta.id}`
      : `${window.location.origin}/assinatura/recibo/${coleta.id}`;
    
    const clienteNome = coleta.razao_social || coleta.nome_fantasia || 'o cliente';
    
    const shareData = {
      title: isSigned 
        ? `Recibo de Coleta Nº ${coleta.numero_coleta}`
        : `Assinatura do Recibo Nº ${coleta.numero_coleta}`,
      text: isSigned
        ? `Segue recibo assinado da coleta para ${clienteNome}.`
        : `Olá! Por favor, assine o recibo da coleta para ${clienteNome}.`,
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
        windowWidth: input.scrollWidth + 50,
        windowHeight: input.scrollHeight + 50,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        width: input.scrollWidth + 20,
        height: input.scrollHeight + 20,
        onclone: (clonedDoc) => {
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
      const ratio = Math.min(widthRatio, heightRatio, 0.6);
      
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      
      const x = (pdfWidth - scaledWidth) / 2;
      const y = (pdfHeight - scaledHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
      
      pdf.setProperties({
        title: `Recibo_de_Coleta_${coleta.numero_coleta?.toString().padStart(6, '0')}`
      });

      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Recibo_de_Coleta_${coleta.numero_coleta?.toString().padStart(6, '0')}.pdf`; /*{data.numero_coleta?.toString().padStart(6, '0')}*/
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
      
      console.log('💰 VERIFICANDO SE DEVE ABRIR PAGAMENTO...');
      console.log('💰 Tipo da coleta:', coleta.tipo_coleta);
      
      if (coleta.tipo_coleta === 'Compra') {
        console.log('🚀 ABRINDO PAGAMENTO PARA COLETA COMPRA...');
        
        const { data: debitEntry, error: debitError } = await supabase
          .from('v_financeiro_completo')
          .select('*')
          .eq('coleta_id', coleta.id)
          .eq('type', 'debito')
          .maybeSingle();

        if (debitError) {
          console.error('❌ Erro ao buscar débito:', debitError);
          toast({ 
            title: 'Erro', 
            description: 'Não foi possível carregar os detalhes do débito.', 
            variant: 'destructive', 
            duration: 5000 
          });
          onClose();
        } else if (!debitEntry) {
          console.warn('⚠️ Débito não encontrado');
          toast({ 
            title: 'Aviso', 
            description: 'Lançamento de débito não encontrado.', 
            variant: 'warning', 
            duration: 5000 
          });
          onClose();
        } else {
          console.log('✅ DÉBITO ENCONTRADO - ABRINDO PAGAMENTO');
          setDebitEntryForPayment(debitEntry);
          setShowPaymentDialog(true);
        }
      } else {
        console.log('📦 Não é coleta Compra, fechando diálogo');
        onClose();
      }

    } catch (err) {
      console.error('❌ Erro ao salvar assinatura:', err);
      toast({ title: 'Erro ao salvar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    console.log('✅ Pagamento concluído com sucesso');
    setShowPaymentDialog(false);
    onClose();
  };

  const handlePaymentClose = () => {
    console.log('🔒 PaymentDialog fechado');
    setShowPaymentDialog(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="sm:max-w-3xl h-[90vh] bg-gray-800 border-gray-700 text-white flex flex-col"
          aria-describedby="recibo-description"
        >
          <DialogHeader>
            <DialogTitle>Visualizar Recibo - {coleta.numero_coleta}</DialogTitle>
            <DialogDescription id="recibo-description" className="sr-only">
              Visualização e assinatura do recibo de coleta {coleta.numero_coleta}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto p-4 bg-white rounded-md">
            {/* 🔽 CORREÇÃO: Garantir que a empresa seja passada para o componente Recibo */}
            <Recibo 
              ref={reciboRef} 
              data={coleta} 
              empresa={empresa} // ← Isso deve estar presente
              signature={coleta.assinatura_url} 
              timezone={empresaTimezone} 
              collectorName={collectorName} 
              coletaDateString={coleta.data_coleta}
              coletaTimeString={coleta.hora_coleta}
            />
            {!isSigned && (
              <div className="mt-6 p-4 border-t-2 border-dashed">
                <Label htmlFor="signature-canvas-modal" className="text-lg font-semibold mb-2 block text-gray-800">
                  Assinatura:
                </Label>
                <div className="bg-gray-100 rounded-md p-1 border-2 border-dashed border-emerald-400">
                  <SignatureCanvas
                    ref={sigCanvas}
                    penColor='black'
                    canvasProps={{ 
                      id: 'signature-canvas-modal', 
                      className: 'w-full h-48 rounded-md',
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

      {showPaymentDialog && debitEntryForPayment && (
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