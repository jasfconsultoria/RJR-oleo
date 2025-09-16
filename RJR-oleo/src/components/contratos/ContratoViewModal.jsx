import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ContratoPDF from '@/components/ContratoPDF';
import { Share2, Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ContratoViewModal = ({ contrato, isOpen, onClose }) => {
  const { toast } = useToast();
  const pdfRef = useRef();
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmpresaData = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('empresa').select('*').single();
        if (error) {
            toast({ title: 'Erro ao buscar dados da empresa', variant: 'destructive' });
        } else {
            setEmpresa(data);
        }
        setLoading(false);
    };

    if (isOpen) {
        fetchEmpresaData();
    }
  }, [isOpen, toast]);
  
  const handleShare = async () => {
    if (!contrato || !contrato.id) {
        toast({ title: 'Erro', description: 'ID do contrato não encontrado.', variant: 'destructive' });
        return;
    }

    let link = '';
    let shareTitle = '';
    let shareText = '';

    if (contrato.status === 'Aguardando Assinatura') {
        link = `${window.location.origin}/assinatura/${contrato.id}`;
        shareTitle = "Link de Assinatura do Contrato";
        shareText = `Olá! Segue o link para assinatura do contrato Nº ${contrato.numero_contrato}.`;
    } else if (contrato.status === 'Ativo') {
        link = `${window.location.origin}/contrato-assinado/${contrato.id}`;
        shareTitle = "Link do Contrato Assinado";
        shareText = `Olá! Segue o link para visualização do contrato assinado Nº ${contrato.numero_contrato}.`;
    } else {
        toast({ title: 'Ação não disponível', description: `Não é possível compartilhar um contrato com status "${contrato.status}".`, variant: 'destructive' });
        return;
    }

    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: link,
            });
            toast({ title: 'Sucesso!', description: 'Contrato compartilhado.' });
        } catch (error) {
            console.error('Erro ao compartilhar:', error);
            toast({ title: 'Erro ao compartilhar', description: 'Não foi possível compartilhar o link.', variant: 'destructive' });
        }
    } else {
        navigator.clipboard.writeText(link);
        toast({
          title: "Link Copiado!",
          description: "O link foi copiado para a área de transferência.",
        });
    }
  };
  
  const handlePrint = async () => {
    const input = pdfRef.current;
    if (!input) {
        toast({ title: 'Erro ao imprimir', description: 'Referência do PDF não encontrada.', variant: 'destructive' });
        return;
    }

    try {
        const canvas = await html2canvas(input, {
            scale: 2,
            useCORS: true,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
        const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
        const width = imgProps.width * ratio;
        const height = imgProps.height * ratio;
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`Contrato_${contrato.numero_contrato}.pdf`);
    } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        toast({ title: 'Erro ao gerar PDF', description: 'Ocorreu um problema ao tentar imprimir o contrato.', variant: 'destructive' });
    }
  };

  if (!contrato) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl h-[90vh] bg-gray-800 border-gray-700 text-white flex flex-col">
        <DialogHeader>
          <DialogTitle>Visualizar Contrato - {contrato.numero_contrato}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-4 bg-white rounded-md">
          {loading || !empresa ? (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <ContratoPDF ref={pdfRef} contrato={contrato} empresa={empresa} showSignature={contrato.status === 'Ativo'} />
          )}
        </div>
        <DialogFooter className="mt-4 flex-col sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-black">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button onClick={handleShare} className="bg-blue-500 hover:bg-blue-600">
              <Share2 className="mr-2 h-4 w-4" /> Compartilhar para Assinatura
          </Button>
          <Button onClick={handlePrint} className="bg-emerald-500 hover:bg-emerald-600" disabled={loading}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ContratoViewModal;