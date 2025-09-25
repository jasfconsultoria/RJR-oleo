import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, ArrowDownSquare, Loader2, Info, User, Search, X } from 'lucide-react';
import { logAction } from '@/lib/logger';
import MovimentacaoFormFields from '@/components/estoque/MovimentacaoFormFields';
import ItensMovimentacaoTable from '@/components/estoque/ItensMovimentacaoTable';
import { parseCurrency, formatCnpjCpf } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect'; // Reintroduzido

const EntradaFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    data: new Date(),
    tipo: 'entrada',
    origem: 'manual',
    document_number: '',
    cliente_id: null, // Agora é o ID do cliente
    observacao: '',
    itens: [{ id: null, produto_id: null, produto_nome: '', unidade: '', quantidade: '' }], // Inicializa com um item vazio
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const documentNumberRef = useRef(null); // Ref para o campo Número do Documento

  // Focar no campo Número do Documento ao carregar (apenas para novas entradas)
  useEffect(() => {
    if (documentNumberRef.current && !isEditing) {
      documentNumberRef.current.focus();
    }
  }, [isEditing]);

  // === Fetch movimentacao quando editar ===
  const fetchMovimentacao = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: movimentacaoData, error: movimentacaoError } = await supabase
        .from('entrada_saida')
        .select('*, cliente:clientes(id, nome, nome_fantasia, cnpj_cpf)')
        .eq('id', id)
        .single();

      if (movimentacaoError) throw movimentacaoError;

      const { data: itensData, error: itensError } = await supabase
        .from('itens_entrada_saida')
        .select('*, produto:produtos(nome, unidade, tipo, codigo)')
        .eq('entrada_saida_id', id);

      if (itensError) throw itensError;

      setFormData({
        ...movimentacaoData,
        data: new Date(movimentacaoData.data),
        cliente_id: movimentacaoData.cliente?.id || null,
        itens: itensData.map(item => ({
          id: item.id,
          produto_id: item.produto_id,
          produto_nome: item.produto.nome,
          unidade: item.produto.unidade,
          tipo: item.produto.tipo,
          codigo: item.produto.codigo,
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

  // === Handlers ===
  const handleFormChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'origem' && value !== 'coleta') {
      setFormData((prev) => ({ 
        ...prev, 
        coleta_id: null, 
        cliente_id: null, 
      }));
    }
  };

  const handleColetaSelect = (coleta) => {
    if (coleta) {
      setFormData((prev) => ({
        ...prev,
        coleta_id: coleta.id,
        cliente_id: coleta.cliente_id,
        document_number: coleta.numero_coleta?.toString().padStart(6, '0'),
        observacao: `Movimentação referente à coleta Nº ${coleta.numero_coleta?.toString().padStart(6, '0')} do cliente ${coleta.cliente_nome}.`,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        coleta_id: null,
        cliente_id: null,
        document_number: '',
        observacao: '',
      }));
    }
  };

  const handleItemsChange = (newItems) => {
    setFormData((prev) => ({ ...prev, itens: newItems }));
  };

  const validateForm = () => {
    if (!formData.data || !formData.tipo || !formData.origem) {
      toast({ title: 'Campos obrigatórios', description: 'Data, Tipo e Origem são obrigatórios.', variant: 'destructive' });
      return false;
    }
    if (formData.origem === 'manual' && !formData.cliente_id) {
      toast({ title: 'Campo obrigatório', description: 'O campo Cliente é obrigatório para origem manual.', variant: 'destructive' });
      return false;
    }
    if (formData.origem === 'coleta' && !formData.coleta_id) {
      toast({ title: 'Campo obrigatório', description: 'Selecione uma Coleta para origem de coleta.', variant: 'destructive' });
      return false;
    }
    // A validação de itens vazios agora é mais permissiva para o item inicial
    if (formData.itens.length === 0 || (formData.itens.length === 1 && !formData.itens[0].produto_id && formData.itens[0].quantidade === '')) {
      toast({ title: 'Itens da movimentação', description: 'Adicione pelo menos um item válido à movimentação.', variant: 'destructive' });
      return false;
    }
    for (const item of formData.itens) {
      // Se o item não está completamente vazio, valide-o
      if (item.produto_id || item.quantidade !== '') {
        if (!item.produto_id) {
          toast({ title: 'Itens inválidos', description: 'Verifique todos os itens: selecione um produto para cada linha preenchida.', variant: 'destructive' });
          return false;
        }
        if (parseCurrency(item.quantidade) <= 0) {
          toast({ title: 'Itens inválidos', description: 'Verifique todos os itens: a quantidade deve ser maior que zero para linhas preenchidas.', variant: 'destructive' });
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Filtrar itens completamente vazios antes de enviar
      const itensToSave = formData.itens.filter(item => item.produto_id !== null || item.quantidade !== '');

      // Desestruturar e remover campos que não pertencem à tabela 'entrada_saida'
      const { 
        itens, 
        ...movimentacaoHeaderToSave 
      } = formData; 
      
      movimentacaoHeaderToSave.user_id = user?.id;

      let savedMovimentacao;
      if (isEditing) {
        const { data, error } = await supabase
          .from('entrada_saida')
          .update(movimentacaoHeaderToSave)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;

        const { error: deleteError } = await supabase.from('itens_entrada_saida').delete().eq('entrada_saida_id', id);
        if (deleteError) throw deleteError;

      } else {
        const { data, error } = await supabase
          .from('entrada_saida')
          .insert(movimentacaoHeaderToSave)
          .select()
          .single();
        if (error) throw error;
        savedMovimentacao = data;
      }

      const itensToInsert = itensToSave.map(item => ({
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
        document_number: savedMovimentacao.document_number,
        coleta_id: savedMovimentacao.coleta_id,
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
                handleSelectChange={handleSelectChange}
                handleColetaSelect={handleColetaSelect}
                isEditing={isEditing}
                type="entrada"
                documentNumberRef={documentNumberRef} // Passando a ref
              />

              {formData.origem === 'manual' && (
                <div className="space-y-2 relative">
                  <ClienteSearchableSelect
                    labelText="Cliente *"
                    value={formData.cliente_id}
                    onChange={(value) => handleFormChange('cliente_id', value)}
                    disabled={isEditing}
                  />
                </div>
              )}

              {/* Componente ItensMovimentacaoTable com altura ajustada */}
              <div>
                <ItensMovimentacaoTable
                  items={formData.itens}
                  onItemsChange={handleItemsChange}
                  type="entrada"
                  isEditing={isEditing}
                />
              </div>
              
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