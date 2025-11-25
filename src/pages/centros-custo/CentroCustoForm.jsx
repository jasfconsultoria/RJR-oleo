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
import { ArrowLeft, Save, PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/logger';

const CentroCustoForm = ({ onSaveSuccess, isModal = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id) && !isModal; // If it's a modal, it's always for new creation

  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const fetchCentroCusto = useCallback(async () => {
    if (!isEditing) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('centro_custos')
      .select('nome')
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: 'Erro ao buscar centro de custo', description: error.message, variant: 'destructive' });
      if (!isModal) navigate('/app/centros-custo');
    } else if (data) {
      setNome(data.nome);
    }
    setLoading(false);
  }, [id, isEditing, navigate, toast, isModal]);

  useEffect(() => {
    fetchCentroCusto();
  }, [fetchCentroCusto]);

  const validateName = useCallback(async (name) => {
    if (!name.trim()) {
      setNameError('O nome do centro de custo é obrigatório.');
      return false;
    }
    
    // Build the query conditionally to avoid errors on new entries
    let query = supabase
      .from('centro_custos')
      .select('id', { count: 'exact' })
      .eq('nome', name.trim());

    if (id) {
      query = query.not('id', 'eq', id);
    }

    const { count, error } = await query;

    if (error) {
      console.error("Erro ao verificar unicidade do nome:", error);
      setNameError('Erro ao verificar nome. Tente novamente.');
      return false;
    }
    if (count > 0) {
      setNameError('Já existe um centro de custo com este nome.');
      return false;
    }
    setNameError('');
    return true;
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const nameIsValid = await validateName(nome);
    if (!nameIsValid) {
      setSaving(false);
      return;
    }

    const dataToSave = { nome: nome.trim(), user_id: user.id };

    let result;
    if (isEditing) {
      result = await supabase.from('centro_custos').update(dataToSave).eq('id', id).select().single();
    } else {
      result = await supabase.from('centro_custos').insert(dataToSave).select().single();
    }

    const { data, error } = result;

    if (error) {
      let title = `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} centro de custo`;
      let description = error.message;
      if (error.code === '23505') { // Unique constraint violation
        title = 'Nome já existe';
        description = `O centro de custo "${nome}" já está cadastrado.`;
        setNameError(description);
      }
      toast({ title, description, variant: 'destructive' });
      await logAction(isEditing ? 'update_cost_center_failed' : 'create_cost_center_failed', { error: error.message, cost_center_name: nome });
    } else {
      toast({ title: `Centro de custo ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`, description: `${nome} foi salvo.` });
      await logAction(isEditing ? 'update_cost_center_success' : 'create_cost_center_success', { cost_center_id: data.id, cost_center_name: data.nome });
      if (onSaveSuccess) {
        onSaveSuccess(data);
      } else {
        navigate('/app/centros-custo');
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isModal ? "" : "max-w-2xl mx-auto p-4"}
    >
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-emerald-300">
            <PlusCircle className="w-8 h-8" />
            {isEditing ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="nome" className="text-lg">Nome do Centro de Custo <span className="text-red-500">*</span></Label>
              <Input
                id="nome"
                name="nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  setNameError(''); // Clear error on change
                }}
                onBlur={(e) => validateName(e.target.value)}
                placeholder="Ex: ADMINISTRAÇÃO, VENDAS, OPERACIONAL"
                required
                className="bg-white/5 border-white/20 rounded-xl"
              />
              {nameError && <p className="text-yellow-400 text-xs mt-1">{nameError}</p>}
            </div>

            <div className="flex justify-between items-center pt-6">
              {!isModal && (
                <Button type="button" onClick={() => navigate('/app/centros-custo')} variant="outline" className="rounded-xl">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
              )}
              <Button type="submit" disabled={saving || nameError} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default CentroCustoForm;