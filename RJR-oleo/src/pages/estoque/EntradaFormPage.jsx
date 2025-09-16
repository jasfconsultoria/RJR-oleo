import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, ArrowDownSquare, Loader2, Info } from 'lucide-react'; // Added Info icon
import { logAction } from '@/lib/logger';
import MovimentacaoFormFields from '@/components/estoque/MovimentacaoFormFields';
import ItensMovimentacaoTable from '@/components/estoque/ItensMovimentacaoTable';
import { parseCurrency } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext'; // Import useAuth
import { Label } from '@/components/ui/label'; // Import Label
import { Textarea } from '@/components/ui/textarea'; // Import Textarea

const EntradaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);
  const { user } = useAuth(); // Get user from useAuth

  const [formData, setFormData] = useState({
    data: new Date(),
    tipo: 'entrada',
    origem: 'manual',
    cliente_id: null,
    observacao: '',
    itens: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false); // For ClienteSearchableSelect

  const fetchMovimentacao = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: movimentacaoData, error: movimentacaoError } = await supabase
        .from('entrada_saida')
        .select('*')
        .eq('id', id)
        .single();

      if (movimentacaoError) throw movimentacaoError;

      const { data: itensData, error: itensError } = await supabase
        .from('itens_entrada_saida')
        .select('*, produto:produtos(nome, unidade, tipo)')
        .eq('entrada_saida_id', id);

      if (itensError) throw itensError;

      setFormData({
        ...movimentacaoData,
        data: new Date(movimentacaoData.data),
        itens: itensData.map(item => ({
          id: item.id,
          produto_id: item.produto_id,
          produto_nome: item.produto.nome,
          unidade: item.produto.unidade,
          tipo: item.produto.tipo,
          quantidade: String(item.quantidade).replace('.', ','),
        })),
      });
    } catch (error) {
      toast({ title: 'Erro ao carregar movimentação', description: error.message, variant: 'destructive' });
      navigate('/app/estoque/movimentacoes');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchMovimentacao();
  }, [fetchMovimentacao]);

  const handleFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemsChange = (newItems) => {
    setFormData((prev) => ({ ...prev, itens: newItems }));
  };

  const validateForm = () => {
    if (!formData.data || !formData.tipo || !formData.origem) {
      toast({ title: 'Campos obrigatórios', description: 'Data, Tipo e Origem são obrigatórios.', variant: 'destructive' });
      return false;
    }
    if (!formData.cliente_id) { // New validation for cliente_id
      toast({ title: 'Campo obrigatório', description: 'O campo Cliente é obrigatório.', variant: 'destructive' });
      return false;
    }
    if (formData.itens.length === 0) {
      toast({ title: 'Itens da movimentação', description: 'Adicione pelo menos um item à movimentação.', variant: 'destructive' });
      return false;
    }
    for (const item of formData.itens) {
      if (!item.produto_id || parseCurrency(item.quantidade) <= 0) {
        toast({ title: 'Itens inválidos', description: 'Verifique todos os itens: produto e quantidade são obrigatórios e a quantidade deve ser maior que zero.', variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const { itens, ...movimentacaoHeader } = formData;
      movimentacaoHeader.user_id = user?.id; // Use user.id from useAuth

      let savedMovimentacao;
      if (isEditing) {
        const { data, error } = await supabase
          .from('entrada_saida')
          .update(movimentacaoHeader)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;

        // Delete existing items and insert new ones
        const { error: deleteError } = await supabase.from('itens_entrada_saida').delete().eq('entrada_saida_id', id);
        if (deleteError) throw deleteError;

      } else {
        const { data, error } = await supabase
          .from('entrada_saida')
          .insert(movimentacaoHeader)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;
      }

      const itensToInsert = itens.map(item => ({
        entrada_saida_id: savedMovimentacao.id,
        produto_id: item.produto_id,
        quantidade: parseCurrency(item.quantidade),
      }));

      const { error: itensInsertError } = await supabase
        .from('itens_entrada_saida')
        .insert(itensToInsert);
      if (itensInsertError) throw itensInsertError;

      await logAction(isEditing ? 'update_stock_entry' : 'create_stock_entry', {
        movimentacao_id: savedMovimentacao.id,
        tipo: savedMovimentacao.tipo,
        origem: savedMovimentacao.origem,
      });

      toast({ title: `Movimentação de ${formData.tipo} ${isEditing ? 'atualizada' : 'registrada'} com sucesso!` });
      navigate('/app/estoque/movimentacoes');

    } catch (error) {
      toast({ title: `Erro ao salvar movimentação de ${formData.tipo}`, description: error.message, variant: 'destructive' });
      await logAction(isEditing ? 'update_stock_entry_failed' : 'create_stock_entry_failed', {
        error: error.message,
        tipo: formData.tipo,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Editar Entrada' : 'Nova Entrada'} de Estoque - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto p-4"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-emerald-300">
              <ArrowDownSquare className="w-8 h-8" />
              {isEditing ? 'Editar Entrada' : 'Nova Entrada'} de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <MovimentacaoFormFields
                formData={formData}
                handleChange={handleFormChange}
                handleSelectChange={handleFormChange}
                isEditing={isEditing}
                type="entrada"
                loadingClients={loadingClients}
              />

              <ItensMovimentacaoTable
                items={formData.itens}
                onItemsChange={handleItemsChange}
                type="entrada"
                isEditing={isEditing}
              />
              
              {/* Moved Observação field here */}
              <div className="md:col-span-2">
                <Label htmlFor="observacao" className="text-lg flex items-center gap-2">
                  <Info className="w-4 h-4" /> Observação
                </Label>
                <Textarea
                  id="observacao"
                  name="observacao"
                  value={formData.observacao}
                  onChange={(e) => handleFormChange('observacao', e.target.value)}
                  placeholder="Detalhes adicionais sobre a movimentação..."
                  className="bg-white/5 border-white/20 rounded-xl"
                />
              </div>

              <div className="flex justify-between items-center pt-6">
                <Button type="button" onClick={() => navigate('/app/estoque/movimentacoes')} variant="outline" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                  {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default EntradaFormPage;