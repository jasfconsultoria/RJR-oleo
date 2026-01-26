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
import { useLocationData } from '@/hooks/useLocationData';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { validateCnpjCpf as validateCnpjCpfFormat } from '@/lib/validators';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { unmask } from '@/lib/utils';
import { useAutoSave } from '@/hooks/useAutoSave';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const ClienteForm = ({ onSaveSuccess, isModal = false, personType = 'pessoa', onCancel }) => {
  const { id } = useParams();
  const navigate = useNavigate();
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
    razao_social: '',
    nome_fantasia: '',
    cnpj_cpf: '',
    telefone: '',
    email: '',
    estado: '',
    municipio: '',
    endereco: '',
    referencia: '',
  });

  // ✅ CORREÇÃO: Estratégia simplificada - SEMPRE carregar do auto-save primeiro
  const autoSaveKey = id ? `clienteForm_edit_${id}` : `clienteForm_new_${personType}`;
  
  const [formData, setFormData, clearSavedData] = useAutoSave(
    autoSaveKey,
    getEmptyFormData(),
    true // ✅ SEMPRE carregar do auto-save
  );

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [isCnpjCpfChecking, setIsCnpjCpfChecking] = useState(false);
  const [cnpjCpfError, setCnpjCpfError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);
  const [documentType, setDocumentType] = useState('cpf'); // 'cpf', 'cnpj', 'outro'

  // Buscar estados e municípios do banco de dados
  const { estados, getMunicipios, fetchMunicipios, loading: locationLoading } = useLocationData();
  const [municipiosOptions, setMunicipiosOptions] = useState([]);

  // Carregar municípios quando o estado mudar
  useEffect(() => {
    const loadMunicipios = async () => {
      if (!formData.estado) {
        setMunicipiosOptions([]);
        return;
      }
      
      const municipios = await fetchMunicipios(formData.estado);
      const options = municipios.map(m => ({ value: m, label: m })).sort((a, b) => a.label.localeCompare(b.label));
      
      // Se há um município no formData mas não está nas opções, adicionar
      if (formData.municipio && !options.find(opt => opt.value === formData.municipio)) {
        options.push({ value: formData.municipio, label: formData.municipio });
        options.sort((a, b) => a.label.localeCompare(b.label));
      }
      
      setMunicipiosOptions(options);
    };
    
    loadMunicipios();
  }, [formData.estado, formData.municipio, fetchMunicipios]);

  // ✅ CORREÇÃO: Verificar se há dados no auto-save
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(autoSaveKey);
      setHasAutoSaveData(!!saved);
    }
  }, [autoSaveKey]);

  // ✅ CORREÇÃO: Fetch dos dados do banco com lógica de merge
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
        // ✅ CORREÇÃO: Merge inteligente entre auto-save e dados do banco
        setFormData(prevFormData => {
          // Se não há dados no auto-save ou estão vazios, usa os dados do banco
          const isAutoSaveEmpty = Object.values(prevFormData).every(value => 
            value === '' || value === null || value === undefined
          );
          
          const finalData = (isAutoSaveEmpty || !hasAutoSaveData) ? data : {
            ...data,        // Dados base do banco
            ...prevFormData // Preserva alterações do auto-save (tem prioridade)
          };
          
          // Carregar municípios imediatamente se houver estado
          if (finalData.estado) {
            fetchMunicipios(finalData.estado).then(municipios => {
              const options = municipios.map(m => ({ value: m, label: m })).sort((a, b) => a.label.localeCompare(b.label));
              
              // Se há um município nos dados mas não está nas opções, adicionar
              if (finalData.municipio && !options.find(opt => opt.value === finalData.municipio)) {
                options.push({ value: finalData.municipio, label: finalData.municipio });
                options.sort((a, b) => a.label.localeCompare(b.label));
              }
              
              setMunicipiosOptions(options);
            });
          }
          
          return finalData;
        });
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
  }, [id, isEditing, toast, setFormData, hasAutoSaveData, fetchMunicipios]);

  // ✅ CORREÇÃO: Buscar dados do banco apenas se estiver editando
  useEffect(() => {
    if (isEditing) {
      // Pequeno delay para garantir que o auto-save carregou primeiro
      const timer = setTimeout(() => {
        fetchClientData();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isEditing, fetchClientData]);

  // ✅ CORREÇÃO: Resetar flag quando o ID mudar
  useEffect(() => {
    if (id) {
      hasFetchedInitialData.current = false;
    }
  }, [id]);

  // Função para gerar código aleatório único (apenas números - 12 dígitos)
  const generateRandomCode = () => {
    // Gera um código numérico de exatamente 12 dígitos
    // Formato: parte do timestamp (6 dígitos) + números aleatórios (6 dígitos) = 12 dígitos
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos do timestamp
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${timestamp}${random}`;
  };

  // Detectar automaticamente o tipo de documento baseado no número de caracteres e validação
  useEffect(() => {
    if (formData.cnpj_cpf) {
      const unmaskedValue = unmask(formData.cnpj_cpf);
      
      if (unmaskedValue.length === 12) {
        // 12 dígitos = sempre "Outro"
        setDocumentType('outro');
      } else if (unmaskedValue.length === 11) {
        // 11 dígitos: verificar se é CPF válido, senão pode ser código "Outro" antigo
        if (validateCnpjCpfFormat(formData.cnpj_cpf)) {
          setDocumentType('cpf');
        } else {
          // Se não é CPF válido, provavelmente é código "Outro" antigo
          setDocumentType('outro');
        }
      } else if (unmaskedValue.length === 14) {
        // 14 dígitos: verificar se é CNPJ válido, senão pode ser código "Outro" antigo
        if (validateCnpjCpfFormat(formData.cnpj_cpf)) {
          setDocumentType('cnpj');
        } else {
          // Se não é CNPJ válido, provavelmente é código "Outro" antigo
          setDocumentType('outro');
        }
      }
    }
  }, [formData.cnpj_cpf]);


  // Handler para mudança do tipo de documento
  const handleDocumentTypeChange = (type) => {
    setDocumentType(type);
    setCnpjCpfError('');
    
    if (type === 'outro') {
      // Gerar código aleatório quando "Outro" for selecionado
      const randomCode = generateRandomCode();
      setFormData((prev) => ({ ...prev, cnpj_cpf: randomCode }));
    } else {
      // Limpar o campo quando mudar para CPF ou CNPJ (apenas se o tipo anterior era "Outro")
      if (documentType === 'outro') {
        setFormData((prev) => ({ ...prev, cnpj_cpf: '' }));
      }
    }
  };

  const validateAndCheckCnpjCpf = useCallback(async (value) => {
    const unmaskedValue = unmask(value);
    
    if (!unmaskedValue) {
      setCnpjCpfError('O CNPJ/CPF é um campo obrigatório.');
      return false;
    }

    // Se for código "Outro" (documentType === 'outro'), apenas verificar duplicidade
    if (documentType === 'outro') {
      setIsCnpjCpfChecking(true);
      try {
        let query = supabase.from('clientes').select('id', { count: 'exact' }).eq('cnpj_cpf', unmaskedValue);
        if (isEditing) {
          query = query.not('id', 'eq', id);
        }
        const { count, error } = await query;

        if (error) throw error;
        
        if (count > 0) {
          setCnpjCpfError(`Código ${value} já cadastrado. Verifique!`);
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
    }

    // Validação para CPF/CNPJ
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
  }, [id, isEditing, documentType]);

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

  const handleBack = () => {
    if (isModal) {
      onCancel();
    } else {
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

    // ✅ CORREÇÃO: Usar razao_social em vez de nome
    if (!formData.razao_social || !formData.estado || !formData.municipio) {
      toast({ 
        title: 'Campos obrigatórios', 
        description: 'Razão Social, Estado e Município são obrigatórios.', 
        variant: 'destructive' 
      });
      setSaving(false);
      return;
    }

    const unmaskedCnpjCpf = unmask(formData.cnpj_cpf);
    if (!unmaskedCnpjCpf) {
      setCnpjCpfError('O CNPJ/CPF é um campo obrigatório.');
      if (cnpjCpfInputRef.current?.element) {
        cnpjCpfInputRef.current.element.focus();
      } else if (cnpjCpfInputRef.current) {
        cnpjCpfInputRef.current.focus();
      }
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
      if (cnpjCpfInputRef.current?.element) {
        cnpjCpfInputRef.current.element.focus();
      } else if (cnpjCpfInputRef.current) {
        cnpjCpfInputRef.current.focus();
      }
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
        // ✅ CORREÇÃO: Usar razao_social em vez de nome
        description: `${formData.razao_social} foi salvo.` 
      });
      
      // ✅ CORREÇÃO: Limpar auto-save apenas após salvar com sucesso
      clearSavedData();
      hasFetchedInitialData.current = false;
      
      if (onSaveSuccess) {
        onSaveSuccess(data);
      } else {
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
        <span className="ml-2 text-base md:text-sm">Carregando dados...</span>
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
        className={isModal ? "" : "max-w-4xl mx-auto p-3 md:p-4"}
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white rounded-xl shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl md:text-xl font-bold flex items-center gap-2 text-emerald-300">
              <UserPlus className="w-5 h-5 md:w-5 md:h-5" />
              {pageTitle}
              {hasAutoSaveData && (
                <span className="text-xs md:text-xs text-yellow-400 ml-2">(Alterações não salvas)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-4 md:space-y-3">
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                <div className="md:col-span-2">
                  <Label className="text-sm md:text-xs mb-2 block">Tipo de Documento</Label>
                  <RadioGroup 
                    value={documentType} 
                    onValueChange={handleDocumentTypeChange}
                    className="flex flex-row gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cpf" id="cpf" className="border-white/30 text-emerald-400" />
                      <Label htmlFor="cpf" className="text-sm md:text-xs cursor-pointer text-white">
                        CPF
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cnpj" id="cnpj" className="border-white/30 text-emerald-400" />
                      <Label htmlFor="cnpj" className="text-sm md:text-xs cursor-pointer text-white">
                        CNPJ
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outro" id="outro" className="border-white/30 text-emerald-400" />
                      <Label htmlFor="outro" className="text-sm md:text-xs cursor-pointer text-white">
                        Outro
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="cnpj_cpf" className="text-sm md:text-xs flex items-center gap-1">
                    CNPJ/CPF <span className="text-red-500">*</span>
                    {isCnpjCpfChecking && <Loader2 className="w-3 h-3 md:w-3 md:h-3 animate-spin" />}
                  </Label>
                  {documentType === 'outro' ? (
                    <Input
                      ref={cnpjCpfInputRef}
                      id="cnpj_cpf"
                      name="cnpj_cpf"
                      value={formData.cnpj_cpf || ''}
                      readOnly
                      className={`w-full flex h-10 md:h-8 rounded-xl border ${cnpjCpfError ? 'border-red-500' : 'border-white/20'} bg-white/10 px-3 py-2 text-sm md:text-xs ring-offset-background cursor-not-allowed opacity-70`}
                    />
                  ) : (
                    <IMaskInput
                      mask={
                        documentType === 'cpf' 
                          ? [{ mask: '000.000.000-00', maxLength: 11 }]
                          : [{ mask: '00.000.000/0000-00' }]
                      }
                      as={Input}
                      ref={cnpjCpfInputRef}
                      id="cnpj_cpf"
                      name="cnpj_cpf"
                      value={formData.cnpj_cpf || ''}
                      onAccept={(value) => handleMaskedChange(String(value), 'cnpj_cpf')}
                      onBlur={handleCnpjCpfBlur}
                      placeholder={documentType === 'cpf' 
                        ? `Digite o CPF d${article} ${titleLabel.toLowerCase()}`
                        : `Digite o CNPJ d${article} ${titleLabel.toLowerCase()}`
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className={`w-full flex h-10 md:h-8 rounded-xl border ${cnpjCpfError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-sm md:text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm md:file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                      required
                    />
                  )}
                  {cnpjCpfError && <p className="text-red-500 text-sm md:text-xs mt-1">{cnpjCpfError}</p>}
                  {documentType === 'outro' && (
                    <p className="text-xs text-emerald-300 mt-1">Código gerado automaticamente</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="telefone" className="text-sm md:text-xs flex items-center gap-1">
                    Telefone <span className="text-red-500">*</span>
                  </Label>
                  <IMaskInput
                    mask={[{ mask: '(00) 0000-0000' }, { mask: '(00) 00000-0000' }]}
                    as={Input}
                    ref={telefoneInputRef}
                    id="telefone"
                    name="telefone"
                    value={formData.telefone || ''}
                    onAccept={(value) => handleMaskedChange(String(value), 'telefone')}
                    onBlur={handleTelefoneBlur}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    className={`w-full flex h-10 md:h-8 rounded-xl border ${telefoneError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-sm md:text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm md:file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                    required
                  />
                  {telefoneError && <p className="text-red-500 text-sm md:text-xs mt-1">{telefoneError}</p>}
                </div>
                
                {/* ✅ CORREÇÃO: Mudar "nome" para "razao_social" */}
                <div className="md:col-span-2">
                  <Label htmlFor="razao_social" className="text-sm md:text-xs">
                    Razão Social <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="razao_social" 
                    name="razao_social" 
                    value={formData.razao_social || ''} 
                    onChange={handleChange} 
                    placeholder={`Razão Social d${article} ${titleLabel.toLowerCase()}`} 
                    required 
                    className="bg-white/5 border-white/20 rounded-xl h-10 md:h-8 text-sm md:text-xs" 
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="nome_fantasia" className="text-sm md:text-xs">Nome Fantasia</Label>
                  <Input 
                    id="nome_fantasia" 
                    name="nome_fantasia" 
                    value={formData.nome_fantasia || ''} 
                    onChange={handleChange} 
                    placeholder={`Nome Fantasia d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-10 md:h-8 text-sm md:text-xs" 
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-sm md:text-xs">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    value={formData.email || ''} 
                    onChange={handleChange} 
                    placeholder={`email d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-10 md:h-8 text-sm md:text-xs" 
                  />
                </div>
                
                <div className="w-full sm:w-auto">
                  <Label htmlFor="estado" className="text-sm md:text-xs">
                    Estado <span className="text-red-500">*</span>
                  </Label>
                  <Select onValueChange={handleStateChange} value={formData.estado || ''} required>
                    <SelectTrigger className="bg-white/5 border-white/20 rounded-xl text-sm md:text-xs px-3 py-2 h-10 md:h-8 w-full">
                      <SelectValue placeholder="Selecione o Estado" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl text-sm md:text-xs max-h-60">
                      {estados.map(s => (
                        <SelectItem key={s.value} value={s.value} className="text-sm md:text-xs">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full sm:w-auto">
                  <Label htmlFor="municipio" className="text-sm md:text-xs">
                    Município <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    options={municipiosOptions}
                    value={formData.municipio || ''}
                    onChange={handleMunicipioChange}
                    placeholder="Selecione o Município"
                    disabled={!formData.estado}
                    inputClassName="text-sm md:text-xs px-3 py-2 bg-white/5 border-white/20 rounded-xl h-10 md:h-8 w-full" 
                    contentClassName="text-sm md:text-xs bg-gray-800 text-white border-gray-700 rounded-xl max-h-60"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="endereco" className="text-sm md:text-xs">Endereço</Label>
                  <Input 
                    id="endereco" 
                    name="endereco" 
                    value={formData.endereco || ''} 
                    onChange={handleChange} 
                    placeholder={`Endereço d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-10 md:h-8 text-sm md:text-xs" 
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="referencia" className="text-sm md:text-xs">Ponto de Referência</Label>
                  <Input 
                    id="referencia" 
                    name="referencia" 
                    value={formData.referencia || ''} 
                    onChange={handleChange} 
                    placeholder={`Ex: Próximo à padaria d${article} ${titleLabel.toLowerCase()}`} 
                    className="bg-white/5 border-white/20 rounded-xl h-10 md:h-8 text-sm md:text-xs" 
                  />
                </div>
              </div>

              <div className="flex flex-row justify-between items-center pt-4 gap-2 sm:gap-3">
                <Button 
                  type="button" 
                  onClick={handleBack} 
                  variant="outline" 
                  className="rounded-xl h-10 md:h-8 px-3 md:px-2 text-sm md:text-xs flex-1 sm:flex-initial"
                >
                  <ArrowLeft className="w-4 h-4 md:w-3 md:h-3 mr-1" />
                  Voltar
                </Button>
                
                <div className="flex flex-row gap-2 flex-1 sm:flex-initial sm:justify-end">
                  {hasAutoSaveData && (
                    <Button 
                      type="button"
                      onClick={() => {
                        clearSavedData();
                        handleBack();
                      }}
                      variant="outline"
                      className="rounded-xl h-10 md:h-8 px-2 md:px-2 text-xs md:text-xs text-yellow-400 border-yellow-400 flex-1 sm:flex-initial"
                    >
                      Descartar
                    </Button>
                  )}
                  
                  <Button 
                    type="submit" 
                    disabled={saving || isCnpjCpfChecking} 
                    className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10 md:h-8 px-3 md:px-2 text-sm md:text-xs flex-1 sm:flex-initial"
                  >
                    {saving ? <Loader2 className="w-4 h-4 md:w-3 md:h-3 mr-1 animate-spin" /> : <Save className="w-4 h-4 md:w-3 md:h-3 mr-1" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default ClienteForm;