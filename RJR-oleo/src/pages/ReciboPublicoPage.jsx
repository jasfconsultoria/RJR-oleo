import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Recibo } from '@/components/Recibo';
import { Loader2, Printer, FileWarning, ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';

const ReciboPublicoPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [coleta, setColeta] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [reciboData, setReciboData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reciboRef = useRef();

  useEffect(() => {
    const fetchReciboData = async () => {
      if (!id) {
        setError("ID do recibo não fornecido.");
        setLoading(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc('get_public_recibo_data', { p_coleta_id: id });

        if (rpcError || !data || !data.coleta) {
          throw new Error("Recibo não encontrado ou acesso negado.");
        }

        if (!data.recibo?.assinatura_url) {
          throw new Error("A assinatura para este recibo não foi encontrada.");
        }
        
        // A view v_coletas_com_status já traz os dados do cliente diretamente
        // então 'data.coleta' já contém 'cliente_nome', 'cliente_cnpj_cpf', etc.
        // Não precisamos mais do 'data.cliente' separado para o componente Recibo.
        setColeta(data.coleta);
        setEmpresa(data.empresa);
        setReciboData(data.recibo);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReciboData();
  }, [id]);

  const handleDownload = async () => {
    const input = reciboRef.current;
    if (!input) {
      toast({ title: 'Erro ao gerar imagem', description: 'Referência do recibo não encontrada.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Gerando imagem...', description: 'Aguarde um momento.' });

    try {
      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `Recibo_${coleta.numero_coleta}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      toast({ title: 'Erro ao gerar imagem', description: 'Ocorreu um problema ao tentar salvar o recibo.', variant: 'destructive' });
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center text-white">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mb-4" />
          <p className="text-lg">Carregando recibo...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center text-white bg-red-900/20 p-10 rounded-lg">
          <FileWarning className="h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Erro ao Carregar Recibo</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <Button asChild variant="outline">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a Página Inicial</Link>
          </Button>
        </div>
      );
    }

    if (coleta && empresa && reciboData) {
      return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="bg-emerald-600/20 border border-emerald-500 text-emerald-100 p-4 rounded-lg mb-6 text-center">
                <h1 className="text-2xl font-bold">Recibo Assinado</h1>
                <p>Visualize, imprima ou baixe o recibo abaixo.</p>
            </div>
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                <div className="p-4 sm:p-8 overflow-x-auto" ref={reciboRef}>
                    <Recibo data={coleta} empresa={empresa} signature={reciboData.assinatura_url} />
                </div>
            </div>
            <div className="mt-6 text-center">
                <Button onClick={handleDownload} className="bg-emerald-500 hover:bg-emerald-600 text-white text-lg px-8 py-6">
                    <Printer className="mr-2 h-5 w-5" /> Baixar Recibo
                </Button>
            </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <Helmet>
        <title>{loading ? 'Carregando Recibo' : `Recibo ${coleta?.numero_coleta || ''}`}</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 p-4 sm:p-8 flex items-center justify-center">
        {renderContent()}
      </div>
    </>
  );
};

export default ReciboPublicoPage;