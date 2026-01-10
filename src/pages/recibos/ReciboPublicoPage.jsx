import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Recibo } from '@/components/recibos/Recibo';
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
  const [collectorName, setCollectorName] = useState(null);
  const reciboRef = useRef();

  useEffect(() => {
    const fetchReciboData = async () => {
      if (!id) {
        setError("ID do recibo não fornecido.");
        setLoading(false);
        return;
      }

      try {
        console.log('🚨 ReciboPublicoPage - Buscando dados com JOIN');

        // BUSCAR DADOS DA EMPRESA - ESPECIFICAR CAMPOS EXPLICITAMENTE
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresa')
          .select('id, nome_fantasia, razao_social, cnpj, telefone, email, endereco, logo_sistema_url, logo_documento_url, timezone, items_per_page, estado, municipio, assinatura_responsavel_url, nome_responsavel_assinatura, created_at, updated_at')
          .limit(1)
          .single();

        if (!empresaError && empresaData) {
          console.log('🏢 Dados da empresa COMPLETOS:', empresaData);
          console.log('🏢 Dados da empresa JSON:', JSON.stringify(empresaData, null, 2));
          setEmpresa(empresaData);
        } else {
          console.error('❌ Erro ao buscar empresa:', empresaError);
        }

        // BUSCA DA COLETA COM CLIENTE
        const { data: coletaComCliente, error: rpcError } = await supabase
          .from('coletas')
          .select(`
            *,
            clientes:cliente_id (
              nome_fantasia,
              razao_social,
              cnpj_cpf,
              endereco,
              municipio,
              estado
            )
          `)
          .eq('id', id)
          .single();

        if (rpcError || !coletaComCliente) {
          throw new Error("Recibo não encontrado ou acesso negado.");
        }

        console.log('✅ ReciboPublicoPage - Dados com cliente:', coletaComCliente);

        // Buscar recibo
        const { data: recibo, error: reciboError } = await supabase
          .from('recibos')
          .select('*')
          .eq('coleta_id', id)
          .single();

        if (!recibo?.assinatura_url) {
          throw new Error("A assinatura para este recibo não foi encontrada.");
        }
        
        // PREPARAR DADOS CORRETOS
        const dadosColeta = {
          ...coletaComCliente,
          nome_fantasia: coletaComCliente.clientes?.nome_fantasia,
          razao_social: coletaComCliente.clientes?.razao_social,
          cliente_cnpj_cpf: coletaComCliente.clientes?.cnpj_cpf,
          cliente_endereco: coletaComCliente.clientes?.endereco,
          cliente_municipio: coletaComCliente.clientes?.municipio,
          cliente_estado: coletaComCliente.clientes?.estado
        };

        console.log('🚨 ReciboPublicoPage - Dados finais:', dadosColeta);

        setColeta(dadosColeta);
        setReciboData(recibo);

        // Buscar coletor
        if (coletaComCliente.user_id) {
          const { data: users, error: usersError } = await supabase.rpc('get_all_users');
          if (!usersError) {
            const collector = users.find(u => u.id === coletaComCliente.user_id);
            setCollectorName(collector?.full_name || collector?.email || 'N/A');
          }
        }

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

    if (coleta && reciboData && empresa) {
      return (
        <div className="w-full max-w-4xl mx-auto">
            <div className="bg-emerald-600/20 border border-emerald-500 text-emerald-100 p-4 rounded-lg mb-6 text-center">
                <h1 className="text-2xl font-bold">Recibo Assinado</h1>
                <p>Visualize, imprima ou baixe o recibo abaixo.</p>
            </div>
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                <div className="p-4 sm:p-8 overflow-x-auto" ref={reciboRef}>
                    <Recibo 
                      data={coleta} 
                      empresa={empresa} 
                      signature={reciboData.assinatura_url} 
                      timezone={'America/Sao_Paulo'} 
                      coletaDateString={coleta.data_coleta} 
                      coletaTimeString={coleta.hora_coleta} 
                      collectorName={collectorName} 
                    />
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