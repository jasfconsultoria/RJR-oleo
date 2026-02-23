import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Package, Loader2, Tag, CheckCircle } from 'lucide-react';
import { logAction } from '@/lib/logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

const RESTRICTED_PRODUCTS = [
  "Óleo de fritura",
  "Óleo de soja novo (900ml)"
];

const ProdutoFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    nome: '',
    unidade: '',
    tipo: 'coletado', // Default to 'coletado'
    ativo: true, // Default to active
    codigo: '', // Novo campo
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRestrictedProduct, setIsRestrictedProduct] = useState(false);

  const fetchProduto = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData(data);
      if (RESTRICTED_PRODUCTS.includes(data.nome)) {
        setIsRestrictedProduct(true);
      }
    } catch (error) {
      toast({ title: 'Erro ao carregar produto', description: error.message, variant: 'destructive' });
      navigate('/app/estoque/produtos');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchProduto();
  }, [fetchProduto]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.nome.trim() || !formData.unidade.trim() || !formData.tipo.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Nome, Unidade e Tipo são obrigatórios.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRestrictedProduct) {
      toast({ title: 'Ação não permitida', description: 'Este produto não pode ser editado.', variant: 'destructive' });
      return;
    }
    if (!validateForm()) return;

    setSaving(true);
    try {
      let result;
      if (isEditing) {
        result = await supabase
          .from('produtos')
          .update(formData)
          .eq('id', id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('produtos')
          .insert(formData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      await logAction(isEditing ? 'update_product' : 'create_product', {
        product_id: result.data.id,
        product_name: result.data.nome,
        product_code: result.data.codigo,
      });

      toast({ title: `Produto ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!` });
      navigate('/app/estoque/produtos');

    } catch (error) {
      toast({ title: `Erro ao salvar produto`, description: error.message, variant: 'destructive' });
      await logAction(isEditing ? 'update_product_failed' : 'create_product_failed', {
        error: error.message,
        product_name: formData.nome,
        product_code: formData.codigo,
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
        <title>{isEditing ? 'Editar Produto' : 'Novo Produto'} - RJR Óleo</title>
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
              <Package className="w-8 h-8" />
              {isEditing ? 'Editar Produto' : 'Novo Produto'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {isRestrictedProduct && (
                <div className="bg-red-500/20 text-red-300 border border-red-400/30 p-3 rounded-xl text-sm mb-4">
                  <p className="font-semibold">Atenção:</p>
                  <p>Este produto é restrito e não pode ser editado ou excluído.</p>
                </div>
              )}
              <div>
                <Label htmlFor="codigo" className="text-lg">Código do Produto</Label>
                <Input id="codigo" name="codigo" value={formData.codigo || 'Será gerado automaticamente'} disabled className="bg-white/5 border-white/20 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="nome" className="text-lg">Nome do Produto <span className="text-red-500">*</span></Label>
                <Input id="nome" name="nome" value={formData.nome} onChange={handleInputChange} placeholder="Ex: Óleo de Fritura" className="bg-white/5 border-white/20 rounded-xl" required disabled={isRestrictedProduct} />
              </div>
              <div>
                <Label htmlFor="unidade" className="text-lg">Unidade <span className="text-red-500">*</span></Label>
                <Input id="unidade" name="unidade" value={formData.unidade} onChange={handleInputChange} placeholder="Ex: kg, litro, unidade" className="bg-white/5 border-white/20 rounded-xl" required disabled={isRestrictedProduct} />
              </div>
              <div>
                <Label htmlFor="tipo" className="text-lg">Tipo <span className="text-red-500">*</span></Label>
                <Select value={formData.tipo} onValueChange={(value) => handleSelectChange('tipo', value)} required disabled={isRestrictedProduct}>
                  <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                    <SelectItem value="coletado">Coletado</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ativo"
                  name="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) => handleSelectChange('ativo', checked)}
                  className="border-white/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
                  disabled={isRestrictedProduct}
                />
                <Label htmlFor="ativo" className="text-lg">Produto Ativo</Label>
              </div>

              <div className="flex justify-between items-center pt-6">
                <Button type="button" onClick={() => navigate('/app/estoque/produtos')} variant="outline" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
                <Button type="submit" disabled={saving || isRestrictedProduct} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
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

export default ProdutoFormPage;