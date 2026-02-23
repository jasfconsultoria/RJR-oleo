import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import CertificadoPDF from '@/components/certificados/CertificadoPDF';
import { Loader2, Printer, Share2, ArrowLeft } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';

const CertificadoDisplayPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [certificado, setCertificado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const certificadoPdfRef = useRef();

  const generateAndProcessPdf = useCallback(async (action) => {
    const input = certificadoPdfRef.current;
    if (!input || !certificado) {
      toast({ title: 'Erro', description: 'Dados do certificado não encontrados para gerar o PDF.', variant: 'destructive' });
      return null;
    }

    setIsGenerating(true);
    
    try {
      const canvas = await html2canvas(input, { 
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      const imgWidth = canvasWidth * ratio;
      const imgHeight = canvasHeight * ratio;
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      
      if (action === 'share') {
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
        return null;
      }

      if (action === 'print') {
        const pdfBlob = pdf.output('blob');
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        const fileName = `certificados/Certificado_${id.substring(0, 8)}_${dateStr}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from('certificados')
          .upload(fileName, pdfBlob, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('certificados').getPublicUrl(fileName);
        
        const { error: dbError } = await supabase
          .from('certificados')
          .update({ pdf_url: urlData.publicUrl })
          .eq('id', certificado.id);

        if (dbError) throw dbError;
        
        toast({ title: 'PDF Salvo!', description: 'O certificado foi salvo no sistema.' });
        return urlData.publicUrl;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: `Houve um problema ao criar o documento: ${error.message}`,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [certificado, id, toast]);

  const fetchCertificadoData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: certData, error: certError } = await supabase
        .from('certificados')
        .select('*')
        .eq('id', id)
        .single();

      if (certError) throw new Error('Certificado não encontrado.');

      const [clienteRes, empresaRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', certData.cliente_id).single(),
        supabase.from('empresa').select('*').single(),
      ]);

      if (clienteRes.error) throw new Error('Dados do cliente não encontrados.');
      if (empresaRes.error) throw new Error('Dados da empresa não encontrados.');

      setCertificado({
        id: certData.id,
        cliente: clienteRes.data,
        empresa: empresaRes.data,
        periodo: { 
          inicio: certData.periodo_inicio, 
          fim: certData.periodo_fim 
        },
        totalKg: certData.total_kg,
        data_emissao: certData.data_emissao,
        pdf_url: certData.pdf_url,
      });

    } catch (error) {
      toast({ title: 'Erro ao carregar certificado', description: error.message, variant: 'destructive' });
      navigate('/app/certificados');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchCertificadoData();
  }, [fetchCertificadoData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-transparent">
        <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Certificado - {certificado?.cliente?.nome || 'Carregando...'}</title>
      </Helmet>
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <Button variant="outline" onClick={() => navigate('/app/certificados')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Lista
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => generateAndProcessPdf('share')} variant="outline" disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              Compartilhar
            </Button>
            <Button onClick={async () => {
                const url = await generateAndProcessPdf('print');
                if (url) window.open(url, '_blank');
              }} 
              disabled={isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Imprimir e Salvar
            </Button>
          </div>
        </div>
        <div className="flex justify-center items-start">
          <div ref={certificadoPdfRef} className="bg-white shadow-2xl" style={{ transformOrigin: 'top center', transform: 'scale(0.8)' }}>
            {certificado && <CertificadoPDF data={certificado} />}
          </div>
        </div>
      </div>
    </>
  );
};

export default CertificadoDisplayPage;