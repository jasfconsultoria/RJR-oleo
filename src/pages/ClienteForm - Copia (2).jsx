import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { validateCnpjCpf as validateCnpjCpfFormat } from '@/lib/validators';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { unmask } from '@/lib/utils';

const ClienteForm = ({ onSaveSuccess, isModal = false, personType = 'pessoa', onCancel }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const isEditing = Boolean(id) && !isModal;
  const cnpjCpfInputRef = useRef(null);
  const telefoneInputRef = useRef(null);

  const hasFetchedInitialData = useRef(false);

  const getLabels = (type) => {
    switch (type) {
      case 'cliente':
        return { title: 'Cliente', article: 'o', pageVerb: 'Novo' };
      case 'fornecedor':
        return { title: 'Fornecedor', article: 'o', pageVerb: 'Novo' };
      default:
        return { title: 'Pessoa', article: 'a', pageVerb: 'Nova' };
    }
  };

  const { title: titleLabel, article, pageVerb } = getLabels(personType);
  const pageTitle = isEditing ? `Editar ${titleLabel}` : `${pageVerb} ${titleLabel}`;

  const getEmptyFormData = () => ({
    nome: '',
    nome_fantasia: '',
    cnpj_cpf: '',
    telefone: '',
    email: '',
    estado: '',
    municipio: '',
    endereco: '',
    referencia: '',
  });

  // Função para salvar dados na URL
  const saveToURL = useCallback((data) => {
    const params = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Função para carregar dados da URL
  const loadFromURL = useCallback(() => {
    const data = getEmptyFormData();
    Object.keys(data).forEach(key => {
      const value = searchParams.get(key);
      if (value) data[key] = value;
    });
    return data;
  }, [searchParams]);

  // Estado inicial - carrega da URL ou usa vazio
  const [formData, setFormData] = useState(() => loadFromURL());

  // Atualiza a URL sempre que os dados mudam
  useEffect(() => {
    saveToURL(formData);
  }, [formData, saveToURL]);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [isCnpjCpfChecking, setIsCnpjCpfChecking] = useState(false);
  const [cnpjCpfError, setCnpjCpfError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');

  const municipiosOptions = useMemo(() => {
    if (!formData.estado) return [];
    return getMunicipios(formData.estado).map(m => ({ value: m, label: m })).sort((a, b) => a.label.localeCompare(b.label));
  }, [formData.estado]);

  // Função para buscar dados do cliente
  const fetchClientData = useCallback(async () => {
    if (hasFetchedInitialData.current || !isEditing) return;

    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        toast({ 
          title: 'Erro ao buscar dados', 
          description: error.message, 
          variant: 'destructive' 
        });
      } else if (data) {
        // Só preenche se não houver dados na URL
        const hasURLData = Array.from(searchParams.keys()).length > 0;
        if (!hasURLData) {
          setFormData(data);
        }
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
      toast({ 
        title: 'Erro inesperado', 
        description: 'Não foi possível carregar os dados.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
      hasFetchedInitialData.current = true;
    }
  }, [id, isEditing, toast, searchParams]);

  // Busca dados apenas uma vez
  useEffect(() => {
    if (isEditing) {
      fetchClientData();
    }
  }, [isEditing]);

  const validateAndCheckCnpjCpf = useCallback(async (value) => {
    const unmaskedValue = unmask(value);
    
    if (!unmaskedValue) {
      setCnpjCpfError('O CNPJ/CPF é um campo obrigatório.');
      return false;
    }

    if (unmaskedValue.length !== 11 && unmaskedValue.length !== 14) {
      setCnpjCpfError('O CNPJ/CPF está incompleto.');
      return false;
    }
    
    if (!validateCnpjCpfFormat(value)) {
      setCnpjCpfError('O número digitado não possui um dígito verificador (DV) válido.');
      return false;
    }

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
    await validateAndCheckCnpjCpf(value);
  };

  const validateTelefone = useCallback((value) => {
    const unmaskedValue = unmask(value);
    if (!unmaskedValue) {
      setTelefoneError('O telefone é um campo obrigatório.');
      return false;
    }
    if (unmaskedValue.length < 10) {
      setTelefoneError('O telefone está incompleto.');
      return false;
    }
    setTelefoneError('');
    return true;
  }, []);

  const handleTelefoneBlur = (e) => {
    validateTelefone(e.target.value);
  };

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
    } else if (field === 'telefone') {
      setTelefoneError('');
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ CORREÇÃO DAS ROTAS - VOLTA PARA A LISTA CORRETA
  const handleBack = () => {
    // Limpa a URL ao voltar
    setSearchParams({}, { replace: true });
    
    if (isModal) {
      onCancel();
    } else {
      // ✅ NAVEGAÇÃO CORRIGIDA - VOLTA PARA A LISTA ESPECÍFICA
      if (personType === 'fornecedor') {
        navigate('/app/cadastro/fornecedores');
      } else if (personType === 'cliente') {
        navigate('/app/cadastro/clientes');
      } else {
        navigate('/app/cadastro');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (!formData.nome || !formData.estado) {
      toast({ 
        title: 'Campos obrigatórios', 
        description: 'Razão Social e Estado são obrigatórios.', 
        variant: 'destructive' 
      });
      setSaving(false);
      return;
    }

    const unmaskedCnpjCpf = unmask(formData.cnpj_cpf);
    if (!unmaskedCnpjCpf) {
      setCnpjCpfError('O CNPJ/CPF é um campo obrigatório.');
      cnpjCpfInputRef.current?.element?.focus();
      toast({ 
        title: 'Verificação falhou', 
        description: 'O CNPJ/CPF é um campo obrigatório.', 
        variant: 'destructive' 
      });
      setSaving(false);
      return;
    }

    const isCnpjCpfValid = await validateAndCheckCnpjCpf(formData.cnpj_cpf);
    if (!isCnpjCpfValid) {
      toast({ 
        title: 'Verificação falhou', 
        description: cnpjCpfError, 
        variant: 'destructive' 
      });
      cnpjCpfInputRef.current?.element?.focus();
      setSaving(false);
      return;
    }

    const isTelefoneValid = validateTelefone(formData.telefone);
    if (!isTelefoneValid) {
      toast({ 
        title: 'Verificação falhou', 
        description: telefoneError, 
        variant: 'destructive' 
      });
      telefoneInputRef.current?.element?.focus();
      setSaving(false);
      return;
    }
    
    const dataToSave = { 
      ...formData, 
      cnpj_cpf: unmaskedCnpjCpf,
      telefone: unmask(formData.telefone),
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
      let title = `Erro ao ${isEditing ? 'atualizar' : 'cadastrar'} ${titleLabel.toLowerCase()}`;
      let description = error.message;

      if (error.code === '23505') {
        title = 'Documento já existe';
        description = `CPF/CNPJ ${formData.cnpj_cpf} já cadastrado. Verifique!`;
        setCnpjCpfError(description);
        cnpjCpfInputRef.current?.element?.focus();
      }

      toast({ title, description, variant: 'destructive' });
    } else {
      toast({ 
        title: `${titleLabel} ${isEditing ? 'atualizado' : 'cadastrado'} com sucesso!`, 
        description: `${formData.nome} foi salvo.` 
      });
      
      // Limpa a URL após salvar
      setSearchParams({}, { replace: true });
      hasFetchedInitialData.current = false;
      
      if (onSaveSuccess) {
        onSaveSuccess(data);
      } else {
        // Navega para a lista correta após salvar
        if (personType === 'fornecedor') {
          navigate('/app/cadastro/fornecedores');
        } else if (personType === 'cliente') {
          navigate('/app/cadastro/clientes');
        } else {
          navigate('/app/cadastro');
        }
      }
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="ml-2">Carregando dados...</span>
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
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-emerald-300">
              <UserPlus className="w-5 h-5" />
              {pageTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-3">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cnpj_cpf" className="text-xs flex items-center gap-1">
                    CNPJ/CPF <span className="text-red-500">*</span>
                    {isCnpjCpfChecking && <Loader2 className="w-3 h-3 animate-spin" />}
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
                    placeholder={`Digite o CNPJ ou CPF d${article} ${titleLabel.toLowerCase()}`}
                    className={`w-full flex h-8 rounded-xl border ${cnpjCpfError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                    required
                  />
                  {cnpjCpfError && <p className="text-red-500 text-xs mt-1">{cnpjCpfError}</p>}
                </div>
                
                <div>
                  <Label htmlFor="telefone" className="text-xs flex items-center gap-1">
                    Telefone <span className="text-red-500">*</span>
                  </Label>
                  <IMaskInput
                    mask={[{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }]}
                    as={Input}
                    ref={telefoneInputRef}
                    id="telefone"
                    name="telefone"
                    value={formData.telefone}
                    onAccept={(value) => handleMaskedChange(String(value), 'telefone')}
                    onBlur={handleTelefoneBlur}
                    placeholder="(00) 00000-0000"
                    className={`w-full flex h-8 rounded-xl border ${telefoneError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                    required
                  />
                  {telefoneError && <p className="text-red-500 text-xs mt-1">{telefoneError}</p>}
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="nome" className="text-xs">Razão Social <span className="text-red-500">*</span></Label>
                  <Input 
                    id="nome" 
                    name="nome" 
                    value={formData.nome} 
                    onChange={handleChange} 
                    placeholder={`Razão Social d${article} ${titleLabel.toLowerCase()}`} 
                    required 
                    className="bg-white/5 border-white/20 rounded-xl h-8 text-xs" 
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="nome_fantasia" className="text-xs">Nome Fantasia</Label>
                  <Input 
                    id="nome_fantasia" 
                    name="nome_fantasia" 
                    value={formData.nome_fantasia} 
                    onChange={handleChange} 
                    placeholder={`Nome Fantasia d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-8 text-xs" 
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    placeholder={`email d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-8 text-xs" 
                  />
                </div>
                
                <div>
                  <Label htmlFor="estado" className="text-xs">Estado <span className="text-red-500">*</span></Label>
                  <Select onValueChange={handleStateChange} value={formData.estado} required>
                    <SelectTrigger className="bg-white/5 border-white/20 rounded-xl text-xs px-3 py-2">
                      {/* Removido h-8 daqui */}
                      <SelectValue placeholder="Selecione o Estado" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-xs">
                      {estados.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="municipio" className="text-xs">Município</Label>
                  <SearchableSelect
                    options={municipiosOptions}
                    value={formData.municipio}
                    onChange={handleMunicipioChange}
                    placeholder="Selecione o Município"
                    disabled={!formData.estado}
                    inputClassName="text-xs px-3 py-2 bg-white/5 border-white/20 rounded-xl" 
                    contentClassName="text-xs bg-gray-800 text-white border-gray-700 rounded-xl"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="endereco" className="text-xs">Endereço</Label>
                  <Input 
                    id="endereco" 
                    name="endereco" 
                    value={formData.endereco} 
                    onChange={handleChange} 
                    placeholder={`Endereço d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-8 text-xs" 
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="referencia" className="text-xs">Ponto de Referência</Label>
                  <Input 
                    id="referencia" 
                    name="referencia" 
                    value={formData.referencia} 
                    onChange={handleChange} 
                    placeholder={`Ex: Próximo à padaria d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-8 text-xs" 
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <Button 
                  type="button" 
                  onClick={handleBack} 
                  variant="outline" 
                  className="rounded-xl h-8 px-2 text-xs"
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Voltar
                </Button>
                
                <Button 
                  type="submit" 
                  disabled={saving || isCnpjCpfChecking} 
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-8 px-2 text-xs"
                >
                  {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
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