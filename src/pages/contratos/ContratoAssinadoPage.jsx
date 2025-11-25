import React, { useState, useEffect, useRef } from 'react';
    import { useParams, Link, useNavigate } from 'react-router-dom'; // Importar useNavigate
    import { Helmet } from 'react-helmet';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import ContratoPDF from '@/components/contratos/ContratoPDF';
    import { Loader2, Printer, FileWarning, ArrowLeft } from 'lucide-react';
    import html2canvas from 'html2canvas';
    import jsPDF from 'jspdf';

    const ContratoAssinadoPage = () => {
      const { id } = useParams();
      const { toast } = useToast();
      const navigate = useNavigate(); // Inicializar useNavigate
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

            if (contratoData.status !== 'Ativo') {
              throw new Error("Este contrato não está ativo ou ainda não foi assinado.");
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
            toast({
              title: 'Erro',
              description: err.message,
              variant: 'destructive',
            });
          } finally {
            setLoading(false);
          }
        };

        fetchContratoData();
      }, [id, toast]);

      const handleDownloadPdf = async () => {
        const input = pdfRef.current;
        if (!input) {
          toast({ title: 'Erro ao gerar PDF', description: 'Referência do PDF não encontrada.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Gerando PDF...', description: 'Aguarde um momento.' });

        try {
          const canvas = await html2canvas(input, {
            scale: 2,
            useCORS: true,
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          
          pdf.save(`Contrato_${contrato.numero_contrato}_assinado.pdf`);
        } catch (error) {
          console.error("Erro ao gerar PDF:", error);
          toast({ title: 'Erro ao gerar PDF', description: 'Ocorreu um problema ao tentar salvar o contrato.', variant: 'destructive' });
        }
      };

      const renderContent = () => {
        if (loading) {
          return (
            <div className="flex flex-col items-center justify-center text-white">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mb-4" />
              <p className="text-lg">Carregando contrato...</p>
            </div>
          );
        }

        if (error) {
          return (
            <div className="flex flex-col items-center justify-center text-white bg-red-900/20 p-10 rounded-lg">
              <FileWarning className="h-12 w-12 text-red-400 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Erro ao Carregar Contrato</h2>
              <p className="text-center text-gray-300 mb-6">{error}</p>
              <Button asChild variant="outline">
                <Link to="/app/dashboard"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Início</Link>
              </Button>
            </div>
          );
        }

        if (contrato && empresa) {
          return (
            <div className="w-full max-w-[240mm] mx-auto"> {/* Increased max-width to 240mm */}
                <div className="bg-emerald-600/20 border border-emerald-500 text-emerald-100 p-4 rounded-lg mb-6 text-center">
                    <h1 className="text-2xl font-bold">Contrato Assinado</h1>
                    <p>Visualize, imprima ou baixe o contrato abaixo.</p>
                </div>
                <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                    <div className="p-4 sm:p-8 max-h-[70vh] overflow-y-auto">
                        <ContratoPDF ref={pdfRef} contrato={contrato} empresa={empresa} showSignature={true} />
                    </div>
                </div>
                <div className="mt-6 flex justify-between items-center gap-4">
                    <Button 
                        onClick={() => navigate('/app/cadastro/contratos')}
                        variant="outline" 
                        className="text-white border-white/50 hover:bg-white/20 hover:text-white text-base px-6 py-3"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <Button onClick={handleDownloadPdf} className="bg-emerald-500 hover:bg-emerald-600 text-white text-base px-6 py-3">
                        <Printer className="mr-2 h-4 w-4" /> Imprimir / Salvar PDF
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
            <title>{loading ? 'Carregando Contrato' : `Contrato ${contrato?.numero_contrato || ''}`}</title>
          </Helmet>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 p-4 sm:p-8 flex items-center justify-center">
            {renderContent()}
          </div>
        </>
      );
    };

    export default ContratoAssinadoPage;