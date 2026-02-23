import React, { useState, useEffect, useRef, useCallback } from 'react';
    import { useParams, useNavigate } from 'react-router-dom';
    import { Helmet } from 'react-helmet';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import SignatureCanvas from 'react-signature-canvas';
    import { Button } from '@/components/ui/button';
    import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
    import ContratoPDF from '@/components/contratos/ContratoPDF';
    import { Loader2, Eraser, CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
    import { Label } from '@/components/ui/label';

    const AssinaturaPage = () => {
      const { id } = useParams();
      const navigate = useNavigate();
      const { toast } = useToast();
      const [contrato, setContrato] = useState(null);
      const [empresa, setEmpresa] = useState(null);
      const [loading, setLoading] = useState(true);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [error, setError] = useState(null);
      const sigCanvas = useRef({});

      const fetchContratoData = useCallback(async () => {
        setLoading(true);
        setError(null);

        const { data: contratoData, error: contratoError } = await supabase
          .from('contratos')
          .select('*, pessoa:clientes(*)')
          .eq('id', id)
          .single();

        if (contratoError || !contratoData) {
          setError('Contrato não encontrado. O link de assinatura pode ser inválido ou o contrato foi removido.');
          setLoading(false);
          return;
        }

        if (contratoData.status !== 'Aguardando Assinatura') {
          setError(`Este contrato não está mais aguardando assinatura. Status atual: ${contratoData.status}.`);
          if (contratoData.status === 'Ativo') {
            navigate(`/contrato-assinado/${id}`);
          }
          setLoading(false);
          return;
        }

        const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('*').single();
        if (empresaError) {
          setError('Não foi possível carregar os dados da empresa. Tente novamente mais tarde.');
          setLoading(false);
          return;
        }

        setContrato(contratoData);
        setEmpresa(empresaData);
        setLoading(false);
      }, [id, navigate]);

      useEffect(() => {
        fetchContratoData();
      }, [fetchContratoData]);

      const clearSignature = () => {
        sigCanvas.current.clear();
      };

      const handleGoBack = () => {
        navigate(-1);
      };

      const handleSubmit = async () => {
        if (sigCanvas.current.isEmpty()) {
          toast({ title: 'Assinatura em branco', description: 'Por favor, assine no campo indicado.', variant: 'destructive' });
          return;
        }
        setIsSubmitting(true);
        
        try {
          const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');

          const { error: updateError } = await supabase
            .from('contratos')
            .update({ 
              status: 'Ativo',
              assinatura_url: signatureDataUrl,
              updated_at: new Date().toISOString(),
            })
            .eq('id', contrato.id);

          if (updateError) throw updateError;
            
          toast({ title: 'Contrato assinado com sucesso!', description: 'Obrigado por sua colaboração.' });
          navigate(`/contrato-assinado/${contrato.id}`);

        } catch (err) {
          toast({ title: 'Erro ao salvar assinatura', description: err.message, variant: 'destructive' });
        } finally {
          setIsSubmitting(false);
        }
      };

      if (loading) {
        return <div className="flex justify-center items-center h-screen bg-gray-900"><Loader2 className="h-10 w-10 text-emerald-400 animate-spin" /></div>;
      }
      
      if (error) {
        return (
          <div className="flex flex-col items-center justify-center text-white bg-red-900/20 p-10 rounded-lg">
            <AlertTriangle className="h-16 w-16 text-yellow-400 mb-4" />
            <h1 className="text-2xl font-bold text-center mb-2">Ocorreu um Problema</h1>
            <p className="text-center text-gray-300">{error}</p>
            <Button onClick={() => navigate('/')} className="mt-6">Voltar para a Página Inicial</Button>
          </div>
        );
      }

      return (
        <>
          <Helmet><title>Assinatura de Contrato - {contrato.numero_contrato}</title></Helmet>
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 p-4 sm:p-8 flex justify-center items-center">
            <Card className="w-full max-w-[240mm] bg-white/10 backdrop-blur-md border-white/20 text-white shadow-2xl animate-fade-in-up">
              <CardHeader>
                <CardTitle className="text-2xl text-center text-emerald-300">
                  Assinatura do Contrato {contrato.numero_contrato}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[70vh] overflow-y-auto p-4 bg-white rounded-md text-black border-2 border-dashed border-emerald-400/50">
                  <ContratoPDF contrato={contrato} empresa={empresa} />
                </div>
                
                <div className="mt-6">
                  <Label htmlFor="signature-canvas" className="text-lg font-semibold mb-2 block text-emerald-200">Sua Assinatura:</Label>
                  <div className="bg-white rounded-md p-1 border-2 border-dashed border-emerald-400">
                    <SignatureCanvas
                      ref={sigCanvas}
                      penColor='black'
                      canvasProps={{ id: 'signature-canvas', className: 'w-full h-48 rounded-md' }}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center gap-4 mt-4">
                <Button variant="destructive" onClick={handleGoBack} className="text-base px-6 py-3">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <div className="flex gap-4">
                    <Button variant="outline" onClick={clearSignature} className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black text-base px-6 py-3">
                        <Eraser className="mr-2 h-4 w-4" /> Limpar
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600 text-base px-6 py-3">
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Assinar e Salvar
                    </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </>
      );
    };

    export default AssinaturaPage;