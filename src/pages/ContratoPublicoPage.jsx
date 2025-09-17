import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import ContratoPDF from '@/components/ContratoPDF';
import { Loader2, Printer, Share2, ArrowLeft, FileWarning } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ContratoPublicoPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contrato, setContrato] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pdfRef = useRef();

  useEffect(() => {
    const fetchContratoData = async () => {
      if (!id) {
        setError("ID do contrato não fornecido.");
        setLoading(false);
        return;
      }

      try {
        const { data: contratoData, error: contratoError } = await supabase
          .from('contratos')
          .select('*, pessoa:clientes(*)')
          .eq('id', id)
          .single();

        if (contratoError || !contratoData) {
          throw new Error("Contrato não encontrado ou acesso negado.");
        }
        
        setContrato(contratoData);

        const { data: empresaData, error: empresaError } = await supabase
          .from('empresa')
          .select('*')
          .single();

        if (empresaError) {
          throw new Error("Não foi possível carregar os dados da empresa.");
        }
        setEmpresa(empresaData);

      } catch (err) {
        setError(err.message);
        toast({ title: 'Erro', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchContratoData();
  }, [id, toast]);

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
            await navigator.share({ title: shareTitle, text: shareText, url: link });
            toast({ title: 'Sucesso!', description: 'Contrato compartilhado.' });
        } catch (error) {
            toast({ title: 'Erro ao compartilhar', description: 'Não foi possível compartilhar o link.', variant: 'destructive' });
        }
    } else {
        navigator.clipboard.writeText(link);
        toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
    }
  };

  const handleDownloadPdf = async () => {
    const input = pdfRef.current;
    if (!input) {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
      return;
    }
    toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });

    try {
      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
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
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="flex items-center justify-center text-white"><Loader2 className="h-12 w-12 animate-spin text-emerald-400" /></div>;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center text-white bg-red-900/20 p-10 rounded-lg">
          <FileWarning className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao Carregar Contrato</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <Button asChild variant="outline" onClick={() => navigate('/app/contratos')}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
        </div>
      );
    }

    if (contrato && empresa) {
      return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="bg-white/10 border border-white/20 backdrop-blur-sm p-4 rounded-lg mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Contrato {contrato.numero_contrato}</h1>
                    <p className="text-emerald-200">Status: {contrato.status}</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => navigate('/app/contratos')} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                    <Button onClick={handleShare} className="bg-blue-500 hover:bg-blue-600"><Share2 className="mr-2 h-4 w-4" /> Compartilhar</Button>
                    <Button onClick={handleDownloadPdf} className="bg-emerald-500 hover:bg-emerald-600"><Printer className="mr-2 h-4 w-4" /> Salvar PDF</Button>
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                <div className="p-4 sm:p-8 overflow-x-auto">
                    <ContratoPDF ref={pdfRef} contrato={contrato} empresa={empresa} showSignature={contrato.status === 'Ativo'} />
                </div>
            </div>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <Helmet><title>{loading ? 'Carregando Contrato' : `Contrato ${contrato?.numero_contrato || ''}`}</title></Helmet>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 p-4 sm:p-8 flex items-center justify-center">
        {renderContent()}
      </div>
    </>
  );
};

export default ContratoPublicoPage;