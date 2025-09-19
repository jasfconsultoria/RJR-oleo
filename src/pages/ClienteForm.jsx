import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, UserPlus, Loader2 } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { estados, getMunicipios } from '@/lib/location';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logAction } from '@/lib/logger';
import { validateCnpjCpf as validateCnpjCpfFormat } from '@/lib/validators';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { unmask } from '@/lib/utils';
import { useAutoSave } from '@/hooks/useAutoSave';

const ClienteForm = ({ onSaveSuccess, isModal = false, personType = 'pessoa' }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id) && !isModal;
  const cnpjCpfInputRef = useRef(null);

  const getLabels = (type) => {
    switch (type) {
      case 'cliente':
        return { title: 'Cliente', article: 'o', pageVerb: 'Novo' };
      case 'fornecedor':
        return { title: 'Fornecedor', article: 'o', pageVerb: 'Novo' };
      default: // 'pessoa'
        return { title: 'Pessoa', article: 'a', pageVerb: 'Nova' };
    }
  };

  const { title: titleLabel, article, pageVerb } = getLabels(personType);
  const pageTitle = isEditing ? `Editar ${titleLabel}` : `${pageVerb} ${titleLabel}`;

  const autoSaveKey = id ? `autoSave_clienteForm_${id}` : 'autoSave_clienteForm_new';

  const [formData, setFormData, clearSavedData] = useAutoSave(autoSaveKey, {
    nome: '', // This will be Razão Social
    nome_fantasia: '', // New field
    cnpj_cpf: '',
    telefone: '',
    email: '',
    estado: '',
    municipio: '',
    endereco: '',
    referencia: '',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCnpjCpfChecking, setIsCnpjCpfChecking] = useState(false);
  const [cnpjCpfError, setCnpjCpfError] = useState('');
  
  const municipiosOptions = useMemo(() => {
    if (!formData.estado) return [];
    return getMunicipios(formData.estado).map(m => ({ value: m, label: m })).sort((a, b) => a.label.localeCompare(b.label));
  }, [formData.estado]);

  const validateAndCheckCnpjCpf = useCallback(async (value) => {
    const unmaskedValue = unmask(value);
    
    // 1. Validate mandatory field
    if (!unmaskedValue) {
      setCnpjCpfError('O CNPJ/CPF é um campo obrigatório.');
      return false;
    }

    // 2. Validate Format
    if (unmaskedValue.length !== 11 && unmaskedValue.length !== 14) {
      setCnpjCpfError('O CNPJ/CPF está incompleto.');
      return false;
    }
    if (!validateCnpjCpfFormat(value)) {
      setCnpjCpfError('O número digitado não possui um dígito verificador (DV) válido.');
      return false;
    }

    // 3. Check for Duplicates
    setIsCnpjCpfChecking(true);
    try {
      let query = supabase.from('clientes').select('id', { count: 'exact' }).eq('cnpj_cpf', unmaskedValue);
      if (isEditing) {
        query = query.not('id', 'eq', id);
      }
      const { count, error } = await query;

      if (error) throw error;
      
      if (count > 0) {
        setCnpjCpfError(`CPF/CNPJ ${value} já cadastrado. Verifique!`);
        return false;
      }
    } catch (error) {
      console.error("Erro na verificação de duplicidade:", error);
      setCnpjCpfError('Não foi possível verificar o documento. Tente novamente.');
      return false;
    } finally {
      setIsCnpjCpfChecking(false);
    }

    setCnpjCpfError('');
    return true;
  }, [id, isEditing]);

  const handleCnpjCpfBlur = async (e) => {
    const { value } = e.target;
    const isValid = await validateAndCheckCnpjCpf(value);
    if (!isValid) {
      cnpjCpfInputRef.current?.element?.focus();
    }
  };

  const fetchCliente = useCallback(async () => {
    if (!isEditing) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      toast({ title: 'Erro ao buscar cliente', description: error.message, variant: 'destructive' });
      if (!isModal) navigate('/app/clientes');
    } else if (data) {
      setFormData((prev) => ({
        ...prev,
        nome: data.nome || '',
        nome_fantasia: data.nome_fantasia || '', // Fetch new field
        cnpj_cpf: data.cnpj_cpf || '',
        telefone: data.telefone || '',
        email: data.email || '',
        estado: data.estado || '',
        municipio: data.municipio || '',
        endereco: data.endereco || '',
        referencia: data.referencia || '',
      }));
    }
    setLoading(false);
  }, [id, isEditing, navigate, toast, setFormData, isModal]);

  useEffect(() => {
    fetchCliente();
  }, [fetchCliente]);

  const handleStateChange = (estado) => {
    setFormData((prev) => ({ ...prev, estado, municipio: '' }));
  };
  
  const handleMunicipioChange = (municipio) => {
    setFormData((prev) => ({ ...prev, municipio: municipio || '' }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleMaskedChange = (value, field) => {
    if (field === 'cnpj_cpf') {
      setCnpjCpfError('');
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (!formData.nome || !formData.estado) {
      toast({ title: 'Campos obrigatórios', description: 'Razão Social e Estado são obrigatórios.', variant: 'destructive' });
      setSaving(false);
      return;
    }

    // Explicitly validate cnpj_cpf for mandatory check before proceeding
    const unmaskedCnpjCpf = unmask(formData.cnpj_cpf);
    if (!unmaskedCnpjCpf) {
      setCnpjCpfError('O CNPJ/CPF é um campo obrigatório.');
      cnpjCpfInputRef.current?.element?.focus();
      toast({ title: 'Verificação falhou', description: 'O CNPJ/CPF é um campo obrigatório.', variant: 'destructive' });
      setSaving(false);
      return;
    }

    const isCnpjCpfValid = await validateAndCheckCnpjCpf(formData.cnpj_cpf);
    if (!isCnpjCpfValid) {
        toast({ title: 'Verificação falhou', description: cnpjCpfError, variant: 'destructive' });
        cnpjCpfInputRef.current?.element?.focus();
        setSaving(false);
        return;
    }
    
    const dataToSave = { 
        ...formData, 
        cnpj_cpf: unmaskedCnpjCpf, // No longer allow null, as it's mandatory
        user_id: user.id 
    };

    let result;
    if (isEditing) {
      result = await supabase.from('clientes').update(dataToSave).eq('id', id).select().single();
    } else {
      result = await supabase.from('clientes').insert(dataToSave).select().single();
    }

    const { data, error } = result;

    if (error) {
      let title = `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} cliente`;
      let description = error.message;

      if (error.code === '23505') { // Unique constraint violation
        title = 'Documento já existe';
        description = `CPF/CNPJ ${formData.cnpj_cpf} já cadastrado. Verifique!`;
        setCnpjCpfError(description);
        cnpjCpfInputRef.current?.element?.focus();
      }

      toast({ title, description, variant: 'destructive' });
      await logAction(isEditing ? 'update_client_failed' : 'create_client_failed', { error: error.message, client_name: formData.nome });
    } else {
      toast({ title: `Cliente ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`, description: `${formData.nome} foi salvo.` });
      await logAction(isEditing ? 'update_client_success' : 'create_client_success', { client_id: data.id, client_name: data.nome });
      clearSavedData(); // Clear auto-saved data on successful submission
      if (onSaveSuccess) {
        onSaveSuccess(data);
      } else {
        navigate('/app/clientes');
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
    <>
      <Helmet>
        <title>{pageTitle} - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={isModal ? "" : "max-w-4xl mx-auto p-4"}
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-emerald-300">
              <UserPlus className="w-8 h-8" />
              {pageTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <Label htmlFor="cnpj_cpf" className="text-lg flex items-center gap-2">
                    CNPJ/CPF <span className="text-red-500">*</span>
                    {isCnpjCpfChecking && <Loader2 className="w-4 h-4 animate-spin" />}
                  </Label>
                  <IMaskInput
                    mask={[
                      { mask: '000.000.000-00', maxLength: 11 },
                      { mask: '00.000.000/0000-00' }
                    ]}
                    as={Input}
                    ref={cnpjCpfInputRef}
                    id="cnpj_cpf"
                    name="cnpj_cpf"
                    value={formData.cnpj_cpf}
                    onAccept={(value) => handleMaskedChange(String(value), 'cnpj_cpf')}
                    onBlur={handleCnpjCpfBlur}
                    placeholder="Digite o CNPJ ou CPF"
                    className={`w-full flex h-10 rounded-xl border ${cnpjCpfError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                    required
                  />
                   {cnpjCpfError && <p className="text-red-500 text-xs mt-1">{cnpjCpfError}</p>}
                </div>
                <div>
                  <Label htmlFor="telefone" className="text-lg">Telefone</Label>
                  <IMaskInput
                    mask={[{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }]}
                    as={Input}
                    id="telefone"
                    name="telefone"
                    value={formData.telefone}
                    onAccept={(value) => handleMaskedChange(String(value), 'telefone')}
                    placeholder="(00) 00000-0000"
                    className="w-full flex h-10 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="nome" className="text-lg">Razão Social <span className="text-red-500">*</span></Label>
                  <Input id="nome" name="nome" value={formData.nome} onChange={handleChange} placeholder="Razão Social" required className="bg-white/5 border-white/20 rounded-xl" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="nome_fantasia" className="text-lg">Nome Fantasia</Label>
                  <Input id="nome_fantasia" name="nome_fantasia" value={formData.nome_fantasia} onChange={handleChange} placeholder="Nome Fantasia" className="bg-white/5 border-white/20 rounded-xl" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-lg">Email</Label>
                  <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@exemplo.com" className="bg-white/5 border-white/20 rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="estado" className="text-lg">Estado <span className="text-red-500">*</span></Label>
                  <Select onValueChange={handleStateChange} value={formData.estado} required>
                    <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
                      <SelectValue placeholder="Selecione o Estado" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                      {estados.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="municipio" className="text-lg">Município</Label>
                   <SearchableSelect
                      options={municipiosOptions}
                      value={formData.municipio}
                      onChange={handleMunicipioChange}
                      placeholder="Selecione o Município"
                      disabled={!formData.estado}
                    />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="endereco" className="text-lg">Endereço</Label>
                  <Input id="endereco" name="endereco" value={formData.endereco} onChange={handleChange} placeholder="Rua, número, bairro" className="bg-white/5 border-white/20 rounded-xl" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="referencia" className="text-lg">Ponto de Referência</Label>
                  <Input id="referencia" name="referencia" value={formData.referencia} onChange={handleChange} placeholder="Ex: Próximo à padaria" className="bg-white/5 border-white/20 rounded-xl" />
                </div>
              </div>

              <div className="flex justify-between items-center pt-6">
                {!isModal && (
                  <Button type="button" onClick={() => navigate('/app/clientes')} variant="outline" className="rounded-xl">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Voltar
                  </Button>
                )}
                <Button type="submit" disabled={saving || isCnpjCpfChecking} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
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

export default ClienteForm;