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
import PaymentDialog from '@/components/financeiro/PaymentDialog';

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
  const sigCanvas = useRef({});

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [debitEntryForPayment, setDebitEntryForPayment] = useState(null);

  // NEW: State to store essential product IDs
  const [frituraProductId, setFrituraProductId] = useState(null);
  const [sojaNovoProductId, setSojaNovoProductId] = useState(null);

  // NEW: Fetch product IDs once on component mount
  useEffect(() => {
    const fetchProductIds = async () => {
      try {
        const { data: frituraId, error: frituraError } = await supabase.rpc('get_product_id_by_name_and_type', { p_product_name: 'Óleo de fritura', p_product_type: 'coletado' });
        if (frituraError) throw frituraError;
        setFrituraProductId(frituraId);

        const { data: sojaNovoId, error: sojaNovoError } = await supabase.rpc('get_product_id_by_name_and_type', { p_product_name: 'Óleo de soja novo (900ml)', p_product_type: 'novo' });
        if (sojaNovoError) throw sojaNovoError;
        setSojaNovoProductId(sojaNovoId);
      } catch (err) {
        console.error('Erro ao buscar IDs de produtos essenciais:', err);
        toast({ title: 'Erro', description: 'Não foi possível carregar IDs de produtos essenciais para o estoque.', variant: 'destructive' });
      }
    };
    fetchProductIds();
  }, [toast]);

  const fetchReciboData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('get_public_recibo_data', { p_coleta_id: id });

      if (rpcError || !data || !data.coleta) {
        throw new Error('Recibo não encontrado. O link pode ser inválido ou o recibo foi removido.');
      }

      if (data.recibo?.assinatura_url) {
        navigate(`/recibo/publico/${id}`);
        return;
      }
      
      setColeta(data.coleta);
      setEmpresa(data.empresa);
      setReciboData(data.recibo);
    } catch (err) {
      setError(err.message);
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

  // ✅ NOVA FUNÇÃO: Sincronizar estoque com a coleta
  const syncEstoqueWithColeta = useCallback(async (coletaId, coletaData) => {
    try {
      console.log('Sincronizando estoque para coleta:', coletaId, coletaData);

      if (!frituraProductId) {
        throw new Error('ID do produto "Óleo de fritura" não disponível.');
      }

      // 1. Fetch Existing Stock Movements
      const { data: existingMovementsRaw, error: fetchExistingError } = await supabase
          .from('entrada_saida')
          .select(`
              id,
              tipo,
              coleta_id,
              document_number,
              observacao,
              data,
              user_id,
              itens_entrada_saida(
                  id,
                  produto_id,
                  quantidade
              )
          `)
          .eq('coleta_id', coletaId);

      if (fetchExistingError) throw new Error(`Erro ao buscar movimentações de estoque existentes: ${fetchExistingError.message}`);

      const existingMovements = existingMovementsRaw || [];
      const processedExistingMovementIds = new Set(); // To track which existing movements are updated/kept

      // 2. Determine Desired Stock Movements
      const desiredMovements = [];
      const quantidadeColetada = parseFloat(coletaData.quantidade_coletada) || 0;
      const quantidadeEntregue = parseFloat(coletaData.quantidade_entregue) || 0;

      // Movement for collected oil (always an 'entrada')
      if (quantidadeColetada > 0 && frituraProductId) {
          desiredMovements.push({
              type: 'entrada',
              product_id: frituraProductId,
              quantity: quantidadeColetada,
              document_number: coletaData.numero_coleta?.toString().padStart(6, '0'),
              observacao: `Entrada de óleo de fritura referente à coleta Nº ${coletaData.numero_coleta?.toString().padStart(6, '0')}.`,
              user_id: coletaData.user_id,
              data: coletaData.data_coleta, // This is already ISO string from ColetaForm
          });
      }

      // Movement for new oil delivered (only for 'Troca' and if quantity > 0)
      if (coletaData.tipo_coleta === 'Troca' && quantidadeEntregue > 0 && sojaNovoProductId) {
          desiredMovements.push({
              type: 'saida',
              product_id: sojaNovoProductId,
              quantity: quantidadeEntregue,
              document_number: coletaData.numero_coleta?.toString().padStart(6, '0'),
              observacao: `Saída de óleo de soja novo referente à coleta Nº ${coletaData.numero_coleta?.toString().padStart(6, '0')} (Troca).`,
              user_id: coletaData.user_id,
              data: coletaData.data_coleta, // This is already ISO string from ColetaForm
          });
      }

      // 3. Reconcile (Upsert/Update)
      for (const desiredMov of desiredMovements) {
          let foundExisting = false;
          for (const existingMov of existingMovements) {
              const existingItem = existingMov.itens_entrada_saida?.[0]; // Assuming one item per entrada_saida for coletas
              if (existingMov.tipo === desiredMov.type && existingItem?.produto_id === desiredMov.product_id) {
                  // Update existing movement
                  const { error: updateMovError } = await supabase
                      .from('entrada_saida')
                      .update({
                          data: desiredMov.data,
                          document_number: desiredMov.document_number,
                          observacao: desiredMov.observacao,
                          user_id: desiredMov.user_id,
                          updated_at: new Date().toISOString(),
                      })
                      .eq('id', existingMov.id);
                  if (updateMovError) throw new Error(`Erro ao atualizar movimentação de estoque (header): ${updateMovError.message}`);

                  const { error: updateItemError } = await supabase
                      .from('itens_entrada_saida')
                      .update({
                          quantidade: desiredMov.quantity,
                          updated_at: new Date().toISOString(),
                      })
                      .eq('id', existingItem.id);
                  if (updateItemError) throw new Error(`Erro ao atualizar item de movimentação de estoque: ${updateItemError.message}`);

                  processedExistingMovementIds.add(existingMov.id);
                  foundExisting = true;
                  break; // Move to the next desired movement
              }
          }

          if (!foundExisting) {
              // Create new movement
              const { data: newMovHeader, error: insertMovError } = await supabase
                  .from('entrada_saida')
                  .insert({
                      coleta_id: coletaId,
                      tipo: desiredMov.type,
                      origem: 'coleta', // Always 'coleta' for these movements
                      document_number: desiredMov.document_number,
                      observacao: desiredMov.observacao,
                      user_id: desiredMov.user_id,
                      data: desiredMov.data,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                  })
                  .select('id')
                  .single();
              if (insertMovError) throw new Error(`Erro ao criar nova movimentação de estoque (header): ${insertMovError.message}`);

              const { error: insertItemError } = await supabase
                  .from('itens_entrada_saida')
                  .insert({
                      entrada_saida_id: newMovHeader.id,
                      produto_id: desiredMov.product_id,
                      quantidade: desiredMov.quantity,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                  });
              if (insertItemError) throw new Error(`Erro ao criar novo item de movimentação de estoque: ${insertItemError.message}`);
          }
      }

      // 4. Delete Obsolete Movements
      for (const existingMov of existingMovements) {
          if (!processedExistingMovementIds.has(existingMov.id)) {
              // Delete associated items first
              const { error: deleteItemsError } = await supabase
                  .from('itens_entrada_saida')
                  .delete()
                  .eq('entrada_saida_id', existingMov.id);
              if (deleteItemsError) console.error(`Erro ao deletar itens de movimentação obsoletos para ${existingMov.id}:`, deleteItemsError);

              // Then delete the header
              const { error: deleteMovError } = await supabase
                  .from('entrada_saida')
                  .delete()
                  .eq('id', existingMov.id);
              if (deleteMovError) console.error(`Erro ao deletar movimentação de estoque obsoleta ${existingMov.id}:`, deleteMovError);
          }
      }

      console.log('Sincronização de estoque concluída para coleta:', coletaId);
      return true;

    } catch (error) {
      console.error('Erro na sincronização de estoque:', error);
      throw error;
    }
  }, [frituraProductId, sojaNovoProductId, toast]);

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

      // ✅ PRIMEIRO: Sincronizar o estoque antes de salvar a assinatura
      await syncEstoqueWithColeta(coleta.id, coleta);
      console.log('Estoque sincronizado com sucesso');

      // ✅ SEGUNDO: Salvar a assinatura do recibo
      const { error: upsertError } = await supabase
        .from('recibos')
        .upsert({
          coleta_id: coleta.id,
          assinatura_url: publicUrl,
        }, { onConflict: 'coleta_id' });

      if (upsertError) throw upsertError;
        
      toast({ title: 'Recibo assinado com sucesso!', description: 'Estoque sincronizado e recibo salvo.' });

      // ✅ TERCEIRO: Para coletas do tipo 'Compra', abrir diálogo de pagamento
      if (coleta.tipo_coleta === 'Compra') {
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('AssinaturaReciboPage: Tentando buscar lançamento de débito para coleta_id:', id);
        const { data: debitEntry, error: debitError } = await supabase
          .from('v_financeiro_coleta')
          .select('*')
          .eq('coleta_id', id)
          .maybeSingle();

        console.log('AssinaturaReciboPage: Resultado da busca do débito:', { debitEntry, debitError });

        if (debitError) {
          console.error('AssinaturaReciboPage: Erro ao buscar lançamento de débito:', debitError);
          toast({ 
            title: 'Erro', 
            description: `Não foi possível carregar os detalhes do débito para pagamento: ${debitError.message}. Por favor, registre o pagamento manualmente na seção Financeiro.`, 
            variant: 'destructive', 
            duration: 8000 
          });
          navigate(`/recibo/publico/${coleta.id}`);
        } else if (!debitEntry) {
          console.warn('AssinaturaReciboPage: Lançamento de débito não encontrado após assinatura para coleta_id:', id);
          toast({ 
            title: 'Aviso', 
            description: 'Lançamento de débito não encontrado. Por favor, registre o pagamento manualmente na seção Financeiro.', 
            variant: 'warning', 
            duration: 8000 
          });
          navigate(`/recibo/publico/${coleta.id}`);
        } else {
          console.log('AssinaturaReciboPage: Lançamento de débito encontrado:', debitEntry);
          setDebitEntryForPayment(debitEntry);
          setShowPaymentDialog(true);
        }
      } else {
        // Para outros tipos de coleta, navegar diretamente para o recibo público
        navigate(`/recibo/publico/${coleta.id}`);
      }

    } catch (err) {
      console.error('Erro no processo de assinatura:', err);
      toast({ 
        title: 'Erro ao processar assinatura', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentDialog(false);
    navigate(`/recibo/publico/${coleta.id}`);
  };

  const handlePaymentClose = () => {
    setShowPaymentDialog(false);
    navigate(`/recibo/publico/${coleta.id}`);
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

  if (!coleta || !empresa) {
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
              <Recibo data={coleta} empresa={empresa} signature={reciboData?.assinatura_url} timezone={empresa?.timezone || 'America/Sao_Paulo'} />
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

      {debitEntryForPayment && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={handlePaymentClose}
          entry={debitEntryForPayment}
          onSuccess={handlePaymentSuccess}
          initialPaidAmount={debitEntryForPayment.amount_balance}
          initialPaymentMethod="pix"
        />
      )}
    </>
  );
};

export default AssinaturaReciboPage;