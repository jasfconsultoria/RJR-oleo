import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Recibo } from '@/components/Recibo';
import { Loader2, Eraser, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';

const AssinaturaReciboPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coleta, setColeta] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [reciboData, setReciboData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [collectorName, setCollectorName] = useState(null);
  const sigCanvas = useRef({});

  const fetchReciboData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('🚨🚨🚨 VERSÃO CORRIGIDA - Buscando dados para página pública');

      // BUSCA COM JOIN - ESTA É A LINHA CRÍTICA
      const { data: coletaData, error: coletaError } = await supabase
        .from('coletas')
        .select(`
          *,
          clientes:cliente_id (
            nome_fantasia,
            razao_social,
            cnpj_cpf,
            endereco
          )
        `)
        .eq('id', id)
        .single();

      if (coletaError) {
        console.error('❌ Erro na busca:', coletaError);
        throw coletaError;
      }

      console.log('✅✅✅ DADOS COM CLIENTE VIA JOIN:', coletaData);
      console.log('🔍 Dados específicos do cliente:', coletaData.clientes);

      // Buscar recibo
      const { data: recibo, error: reciboError } = await supabase
        .from('recibos')
        .select('*')
        .eq('coleta_id', id)
        .single();

      if (!reciboError && recibo?.assinatura_url) {
        navigate(`/recibo/publico/${id}`);
        return;
      }

      // Buscar empresa
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresa')
        .select('*')
        .single();

      if (empresaError) {
        console.error('Erro ao buscar empresa:', empresaError);
      }

      // Buscar coletor
      let coletorNome = 'N/A';
      if (coletaData.user_id) {
        const { data: users, error: usersError } = await supabase.rpc('get_all_users');
        if (!usersError) {
          const collector = users.find(u => u.id === coletaData.user_id);
          coletorNome = collector?.full_name || collector?.email || 'N/A';
        }
      }

      // DADOS FINAIS CORRETOS
      const dadosFinais = {
        ...coletaData,
        // Dados do cliente - USANDO OS CAMPOS CORRETOS
        nome_fantasia: coletaData.clientes?.nome_fantasia || 'Nome não encontrado',
        razao_social: coletaData.clientes?.razao_social || 'Razão social não encontrada',
        cliente_cnpj_cpf: coletaData.clientes?.cnpj_cpf || 'CNPJ não informado',
        cliente_endereco: coletaData.clientes?.endereco || 'Endereço não informado',
        collectorName: coletorNome
      };

      console.log('🚨🚨🚨 DADOS FINAIS ENVIADOS PARA RECIBO:', dadosFinais);

      setColeta(dadosFinais);
      setEmpresa(empresaData || {});
      setReciboData(recibo);
      setCollectorName(coletorNome);

    } catch (err) {
      console.error('❌ Erro geral:', err);
      setError('Recibo não encontrado ou acesso negado');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchReciboData();
  }, [fetchReciboData]);

  const clearSignature = () => {
    sigCanvas.current.clear();
  };

  const handleClose = () => {
    window.close();
  };

  const handleSubmit = async () => {
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
      await new Promise(resolve => setTimeout(resolve, 1000));
      navigate(`/recibo/publico/${coleta.id}`);

    } catch (err) {
      console.error('Erro:', err);
      toast({ title: 'Erro ao processar assinatura', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-900"><Loader2 className="h-10 w-10 text-emerald-400 animate-spin" /></div>;
  }
  
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-900 text-white p-4">
        <AlertTriangle className="h-16 w-16 text-yellow-400 mb-4" />
        <h1 className="text-2xl font-bold text-center mb-2">Ocorreu um Problema</h1>
        <p className="text-center text-gray-300">{error}</p>
        <Button onClick={() => navigate('/')} className="mt-6">Voltar para a Página Inicial</Button>
      </div>
    );
  }

  if (!coleta) {
    return <div className="flex justify-center items-center h-screen bg-gray-900"><Loader2 className="h-10 w-10 text-emerald-400 animate-spin" /></div>;
  }

  return (
    <>
      <Helmet><title>Assinatura de Recibo - {coleta.numero_coleta}</title></Helmet>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 p-4 sm:p-8 flex justify-center items-center">
        <Card className="w-full max-w-4xl bg-white/10 backdrop-blur-md border-white/20 text-white shadow-2xl animate-fade-in-up">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-emerald-300">
              Assinatura do Recibo Nº {String(coleta.numero_coleta).padStart(6, '0')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[50vh] overflow-y-auto p-4 bg-white rounded-md text-black border-2 border-dashed border-emerald-400/50">
              <Recibo 
                data={coleta} 
                empresa={empresa} 
                signature={reciboData?.assinatura_url} 
                timezone={empresa?.timezone || 'America/Sao_Paulo'} 
                collectorName={collectorName}
                coletaDateString={coleta.data_coleta}
                coletaTimeString={coleta.hora_coleta}
              />
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
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
            <Button variant="destructive" onClick={handleClose}>
                <XCircle className="mr-2 h-4 w-4" /> Fechar
            </Button>
            <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="outline" onClick={clearSignature} className="border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black">
                    <Eraser className="mr-2 h-4 w-4" /> Limpar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-emerald-500 hover:bg-emerald-600">
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Assinar e Sincronizar
                </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};

export default AssinaturaReciboPage;