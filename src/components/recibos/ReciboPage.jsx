import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { ReciboViewDialog } from '@/components/coletas/ReciboViewDialog';
import { Loader2 } from 'lucide-react';

const ReciboPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coleta, setColeta] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        toast({ title: 'Erro', description: 'ID do recibo não fornecido', variant: 'destructive' });
        navigate('/app/coletas');
        return;
      }

      try {
        console.log('🔍 ReciboPage - Buscando coleta ID:', id);

        // Buscar dados da coleta com JOIN no cliente
        const { data: coletaData, error: coletaError } = await supabase
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

        if (coletaError) {
          console.error('❌ Erro ao buscar coleta:', coletaError);
          throw coletaError;
        }

        // Combinar dados da coleta com dados do cliente
        const dadosCompletos = {
          ...coletaData,
          nome_fantasia: coletaData.clientes?.nome_fantasia,
          razao_social: coletaData.clientes?.razao_social,
          cnpj_cpf: coletaData.clientes?.cnpj_cpf,
          cliente_endereco: coletaData.clientes?.endereco,
          cliente_municipio: coletaData.clientes?.municipio,
          cliente_estado: coletaData.clientes?.estado
        };

        console.log('✅ Coleta encontrada com dados do cliente:', dadosCompletos);
        console.log('🔍 Campos do cliente (ORDEM CORRETA):', {
          nome_fantasia: dadosCompletos.nome_fantasia,
          razao_social: dadosCompletos.razao_social,
          cnpj_cpf: dadosCompletos.cnpj_cpf,
          endereco: dadosCompletos.endereco
        });

        // Buscar dados da empresa - ESPECIFICAR CAMPOS EXPLICITAMENTE
        const { data: empresaData, error: empresaError } = await supabase
          .from('empresa')
          .select('id, nome_fantasia, razao_social, cnpj, telefone, email, endereco, logo_sistema_url, logo_documento_url, timezone, items_per_page, estado, municipio, assinatura_responsavel_url, nome_responsavel_assinatura, created_at, updated_at')
          .single();

        if (empresaError) {
          console.error('❌ Erro ao buscar empresa:', empresaError);
        }

        setColeta(dadosCompletos);
        setEmpresa(empresaError ? getDefaultEmpresa() : empresaData);

      } catch (error) {
        console.error('❌ Erro ao carregar recibo:', error);
        toast({ 
          title: 'Erro', 
          description: 'Não foi possível carregar o recibo', 
          variant: 'destructive' 
        });
        navigate('/app/coletas');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, toast]);

  const getDefaultEmpresa = () => ({
    timezone: 'America/Sao_Paulo',
    items_per_page: 25,
    nome_fantasia: 'Nome da Empresa',
    razao_social: 'Razão Social',
    cnpj: 'N/A',
    telefone: '',
    email: '',
    endereco: ''
  });

  const handleClose = () => {
    navigate('/app/coletas');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center text-white">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-400 mb-4" />
          <p>Carregando recibo...</p>
        </div>
      </div>
    );
  }

  return (
    <ReciboViewDialog
      coleta={coleta}
      empresa={empresa}
      isOpen={true}
      onClose={handleClose}
      empresaTimezone={empresa?.timezone || 'America/Sao_Paulo'}
      showPaymentAfterSignature={true}
    />
  );
};

export default ReciboPage;