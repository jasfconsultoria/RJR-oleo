import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import CertificadoPDF from '@/components/certificados/CertificadoPDF';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CertificadoPublicoPage = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const [certificado, setCertificado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCertificadoData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: certData, error: certError } = await supabase
        .from('certificados')
        .select('*')
        .eq('id', id)
        .single();

      if (certError || !certData) throw new Error('Certificado não encontrado ou inválido.');

      const [clienteRes, empresaRes] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', certData.cliente_id).single(),
        supabase.from('empresa').select('*').single(),
      ]);

      if (clienteRes.error) throw new Error('Dados do cliente não encontrados.');
      if (empresaRes.error) throw new Error('Dados da empresa não encontrados.');

      const fullCertData = {
        id: certData.id,
        cliente: clienteRes.data,
        empresa: empresaRes.data,
        periodo: { 
          inicio: certData.periodo_inicio, 
          fim: certData.periodo_fim 
        },
        totalKg: certData.total_kg,
        data_emissao: certData.data_emissao,
      };
      setCertificado(fullCertData);

    } catch (err) {
      setError(err.message);
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchCertificadoData();
  }, [fetchCertificadoData]);

  return (
    <>
      <Helmet>
        <title>Validação de Certificado - RJR Óleo</title>
      </Helmet>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4">
        <div className="w-full max-w-6xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h1 className="text-2xl font-bold text-center text-gray-800">Validação de Certificado</h1>
            {loading && (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                <p className="ml-4 text-lg">Verificando autenticidade...</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center p-8 text-red-600">
                <ShieldX className="h-12 w-12 mb-4" />
                <p className="text-xl font-semibold">Certificado Inválido</p>
                <p>{error}</p>
              </div>
            )}
            {certificado && !loading && (
              <div className="flex flex-col items-center p-8 text-green-600">
                <ShieldCheck className="h-12 w-12 mb-4" />
                <p className="text-xl font-semibold">Certificado Autêntico</p>
                <p>Este documento foi emitido por {certificado.empresa.nome_fantasia} para {certificado.cliente.nome}.</p>
              </div>
            )}
          </div>

          {certificado && (
            <div className="flex justify-center items-start">
              <div className="bg-white shadow-2xl" style={{ transformOrigin: 'top center', transform: 'scale(0.8)' }}>
                <CertificadoPDF data={certificado} />
              </div>
            </div>
          )}

          <div className="text-center mt-8">
            <Button asChild variant="outline">
              <Link to="/">Voltar para a página inicial</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CertificadoPublicoPage;