import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, UserPlus, Loader2, MapPin } from 'lucide-react';
import { IMaskInput } from 'react-imask';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocationData } from '@/hooks/useLocationData';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { validateCnpjCpf as validateCnpjCpfFormat } from '@/lib/validators';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { unmask, formatCnpjCpf, cn } from '@/lib/utils';
import { useAutoSave } from '@/hooks/useAutoSave';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { logAction } from '@/lib/logger';
import { Info } from 'lucide-react';

const ClienteForm = ({ onSaveSuccess, isModal = false, personType = 'pessoa', onCancel }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
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
    cep: '',
    latitude: '',
    longitude: '',
    data_ultima_coleta: null,
    media_dias_coleta: '',
    proxima_coleta_prevista: null,
  });

  // ✅ CORREÇÃO: Estratégia simplificada - SEMPRE carregar do auto-save primeiro
  const autoSaveKey = id ? `clienteForm_edit_${id}` : `clienteForm_new_${personType}`;

  const [formData, setFormData, clearSavedData] = useAutoSave(
    autoSaveKey,
    getEmptyFormData(),
    !location.state?.clearForm // ✅ Só carregar se não for solicitado limpar (Vindo da lista)
  );

  // Helper para formatar município em Title Case (Palmas em vez de PALMAS)
  const formatMunicipio = useCallback((str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/(?:^|\s|-)\b\w/g, (m) => m.toUpperCase());
  }, []);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [isCnpjCpfChecking, setIsCnpjCpfChecking] = useState(false);
  const [cnpjCpfError, setCnpjCpfError] = useState('');
  const [telefoneError, setTelefoneError] = useState('');
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);

  // ✅ CORREÇÃO: Inicializar documentType baseado no valor atual para evitar truncamento no load
  const [documentType, setDocumentType] = useState(() => {
    const unmasked = unmask(formData?.cnpj_cpf || '');
    if (unmasked.length === 14) return 'cnpj';
    if (unmasked.length === 11) return 'cpf';
    if (unmasked.length === 12) return 'outro';
    return 'cpf';
  });

  const [manualEdits, setManualEdits] = useState({}); // Rastrear campos alterados manualmente
  const [cnpjRegistryStatus, setCnpjRegistryStatus] = useState(null); // Armazenar status cadastral da API

  // Buscar estados e municípios do banco de dados
  const { estados, getMunicipios, fetchMunicipios, loading: locationLoading } = useLocationData();
  const [municipiosOptions, setMunicipiosOptions] = useState([]);

  // Carregar municípios quando o estado mudar
  useEffect(() => {
    // Sincronizar coordenadas vindas do mapa se houver
    if (location.state?.latitude && location.state?.longitude) {
      setFormData(prev => ({
        ...prev,
        ...location.state
      }));
    }
  }, [location.state, setFormData]);
  useEffect(() => {
    const loadMunicipios = async () => {
      if (!formData.estado) {
        setMunicipiosOptions([]);
        return;
      }

      const municipios = await fetchMunicipios(formData.estado);
      const options = [...municipios].sort((a, b) => a.label.localeCompare(b.label));

      // Se há um município no formData mas não é um código numérico (nome legado), não adicionar às opções
      // Isso força o usuário a selecionar um município da lista oficial
      if (formData.municipio && !options.find(opt => opt.value === formData.municipio) && isNaN(formData.municipio)) {
        console.warn('⚠️ [ClienteForm] Município legado detectado (nome em vez de código):', formData.municipio);
      }

      setMunicipiosOptions(options);
    };

    loadMunicipios();
  }, [formData.estado, formData.municipio, fetchMunicipios]);

  // ✅ NOVO: Recalcular próxima coleta automaticamente ao mudar a média
  useEffect(() => {
    if (formData.data_ultima_coleta && formData.media_dias_coleta) {
      const lastDate = new Date(formData.data_ultima_coleta);
      const days = parseInt(formData.media_dias_coleta, 10);

      if (!isNaN(days)) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + days);

        // Só atualiza se for diferente para evitar loop
        const nextDateStr = nextDate.toISOString();
        if (formData.proxima_coleta_prevista !== nextDateStr) {
          setFormData(prev => ({
            ...prev,
            proxima_coleta_prevista: nextDateStr
          }));
        }
      }
    }
  }, [formData.data_ultima_coleta, formData.media_dias_coleta, formData.proxima_coleta_prevista, setFormData]);

  // ✅ CORREÇÃO: Limpeza inteligente no MOUNT e via State
  useEffect(() => {
    // 1. Prioridade: Limpeza solicitada via navegação (Botão "Novo")
    if (location.state?.clearForm && !id) {
      console.log('🧹 [ClienteForm] Limpando formulário via navigation state');
      clearSavedData();
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    // 2. Limpeza de rascunhos de registros já existentes
    if (!id && (formData.id || formData.cnpj_cpf)) {
      const checkAndPurgeDuplicateDraft = async () => {
        // Se tem ID no rascunho de um "Novo", é lixo de um duplicado anterior. LIMPAR.
        if (formData.id) {
          console.log('🧹 [ClienteForm] Detectado ID em rascunho de novo registro. Limpando...');
          clearSavedData();
          return;
        }

        const unmasked = unmask(formData.cnpj_cpf);
        if (unmasked.length === 11 || unmasked.length === 14) {
          const { count, error } = await supabase
            .from('clientes')
            .select('id', { count: 'exact' })
            .eq('cnpj_cpf', unmasked);

          if (!error && count > 0) {
            console.log('🧹 [ClienteForm] Detectado rascunho de registro já existente. Limpando...');
            clearSavedData();
          }
        }
      };

      checkAndPurgeDuplicateDraft();
    }
  }, [id, location.state?.clearForm]); // Mantemos dependências mínimas para o mount

  // ✅ CORREÇÃO: Remover o useEffect anterior que limpava via state, pois agora é via mount-check

  // ✅ CORREÇÃO: Verificar se há dados no auto-save
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(autoSaveKey);
      setHasAutoSaveData(!!saved);
    }
  }, [autoSaveKey]);

  // ✅ NOVO: O campo de documento deve estar bloqueado se for edição ou se detectado um duplicado carregado
  const isDocumentDisabled = isEditing || cnpjRegistryStatus === 'DUPLICATE' || formData.id;

  // No cadastro de clientes o botão selecionar no mapa deve ficar habilitado
  // mas somente permitir selecionar no mapa se tiver cpf/cnpj e nome fantasia já preenchidos.
  const handleMapClick = () => {
    const unmaskedCnpjCpf = unmask(formData.cnpj_cpf || '');
    if (!unmaskedCnpjCpf || !formData.nome_fantasia?.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Para selecionar no mapa, preencha o CPF/CNPJ e o Nome Fantasia.",
        variant: "warning"
      });
      return;
    }

    navigate('/app/cadastro/clientes/mapa', {
      state: {
        returnTo: location.pathname,
        currentData: formData
      }
    });
  };

  const isMapCriteriaMet = useMemo(() => {
    const unmaskedCnpjCpf = unmask(formData.cnpj_cpf || '');
    return !!unmaskedCnpjCpf && !!formData.nome_fantasia?.trim();
  }, [formData.cnpj_cpf, formData.nome_fantasia]);

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
      let query = supabase.from('clientes').select('*', { count: 'exact' }).eq('cnpj_cpf', unmaskedValue);
      if (isEditing) {
        query = query.not('id', 'eq', id);
      }
      const { data: checkData, count, error: checkError } = await query;

      if (checkError) throw checkError;

      if (count > 0) {
        const existingRecord = checkData[0];
        const msg = `${documentType === 'cnpj' ? 'CNPJ' : 'CPF'} ${value} já cadastrado no sistema.`;

        setCnpjCpfError(msg);
        if (documentType === 'cnpj') setCnpjRegistryStatus('DUPLICATE');

        // Carregar dados existentes no formulário atual
        if (!isEditing && existingRecord) {
          console.log('📝 [ClienteForm] Carregando dados do registro duplicado:', existingRecord.id);

          // Formatar datas e valores para o formulário
          const recordToLoad = {
            ...existingRecord,
            cnpj_cpf: formatCnpjCpf(existingRecord.cnpj_cpf),
            telefone: existingRecord.telefone ? existingRecord.telefone : ''
          };

          setFormData(recordToLoad);

          toast({
            title: "Registro encontrado",
            description: "Os dados existentes foram carregados no formulário.",
          });
        }

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

  const fetchCnpjData = useCallback(async (cnpj) => {
    const unmaskedCnpj = unmask(cnpj);
    if (unmaskedCnpj.length !== 14 || isCnpjCpfChecking) return;

    setIsCnpjCpfChecking(true);
    setCnpjRegistryStatus(null);
    setCnpjCpfError('');

    try {
      // 1. Verificar duplicidade no banco local PRIMEIRO
      let query = supabase.from('clientes').select('*', { count: 'exact' }).eq('cnpj_cpf', unmaskedCnpj);
      if (isEditing) {
        query = query.not('id', 'eq', id);
      }
      const { data: cnpjCheckData, count, error: checkError } = await query;

      if (checkError) {
        console.error("Erro na verificação de duplicidade:", checkError);
        throw new Error("Erro ao verificar duplicidade no banco de dados.");
      }

      if (count > 0) {
        const existingRecord = cnpjCheckData[0];
        console.log('📍 [ClienteForm] CNPJ já cadastrado localmente, ID:', existingRecord.id);

        // Parar o loading antes de atualizar os dados
        setIsCnpjCpfChecking(false);
        setCnpjRegistryStatus('DUPLICATE');
        setCnpjCpfError(`CNPJ ${cnpj} já cadastrado no sistema.`);

        if (!isEditing && existingRecord) {
          const recordToLoad = {
            ...existingRecord,
            cnpj_cpf: formatCnpjCpf(existingRecord.cnpj_cpf),
            telefone: existingRecord.telefone ? existingRecord.telefone : ''
          };
          setFormData(recordToLoad);

          toast({
            title: "CNPJ já cadastrado",
            description: "Os dados foram carregados automaticamente.",
          });
        }
        return; // Retorna aqui, NÃO define ERROR
      }

      const response = await fetch(`https://api.opencnpj.org/${unmaskedCnpj}`);

      if (!response.ok) {
        if (response.status === 404) {
          setCnpjRegistryStatus('NOT_FOUND');
          toast({
            title: "CNPJ não encontrado",
            description: "O CNPJ informado não foi encontrado na base de dados.",
            variant: "destructive"
          });
        } else {
          setCnpjRegistryStatus('ERROR');
        }
        return;
      }

      const data = await response.json();
      console.log('✅ [ClienteForm] Dados recebidos da API:', data);

      // Salvar log da consulta no banco de dados
      const { error: logError } = await supabase
        .from('log_consultas_cnpj')
        .insert({
          cnpj: unmaskedCnpj,
          response: data,
          user_id: user?.id
        });

      if (logError) console.error("Erro ao salvar log de consulta:", logError);

      if (data) {
        // Armazenar status para alerta visual (API usa situacao_cadastral ou status)
        const situacao = data.situacao_cadastral || data.status || (data.company && data.company.status) || 'ATIVA';
        console.log('📍 [ClienteForm] Situação cadastral:', situacao);
        setCnpjRegistryStatus(situacao);

        const newValues = {};

        // Mapear campos respeitando edições manuais e suportando estruturas flat e nested
        // Razão Social
        const razaoSocial = data.razao_social || (data.company && data.company.name);
        if (razaoSocial && !manualEdits.razao_social) newValues.razao_social = razaoSocial;

        // Nome Fantasia
        const nomeFantasia = data.nome_fantasia || (data.company && data.company.trade);
        if (nomeFantasia && !manualEdits.nome_fantasia) newValues.nome_fantasia = nomeFantasia;

        // Email
        const email = data.email || (data.company && data.company.emails && data.company.emails[0]?.address);
        if (email && !manualEdits.email) newValues.email = email;

        // Telefone
        let phone = '';
        if (data.telefones && data.telefones[0]) {
          phone = `${data.telefones[0].ddd || ''}${data.telefones[0].numero || ''}`;
        } else if (data.company && data.company.phones && data.company.phones[0]) {
          phone = data.company.phones[0].number;
        }
        if (phone && !manualEdits.telefone) newValues.telefone = phone;

        // Endereço e Localização
        const cep = data.cep || (data.address && data.address.zip);
        if (cep && !manualEdits.cep) newValues.cep = cep;

        const uf = data.uf || data.estado || (data.address && data.address.state);
        if (uf && !manualEdits.estado) newValues.estado = uf;

        const municipioNome = data.municipio || (data.address && data.address.city);
        if (municipioNome && uf && !manualEdits.municipio) {
          // Buscar o código do município no banco de dados pelo nome e UF
          const { data: municipioData } = await supabase
            .from('municipios')
            .select('codigo')
            .eq('uf', uf)
            .ilike('municipio', municipioNome)
            .single();

          if (municipioData?.codigo) {
            newValues.municipio = municipioData.codigo;
          } else {
            // Se não encontrar o código, mantém vazio para obrigar seleção manual
            newValues.municipio = '';
            console.warn(`⚠️ [ClienteForm] Código IBGE não encontrado para: ${municipioNome} (${uf})`);
          }
        }
        if (!manualEdits.endereco) {
          const street = data.logradouro || (data.address && data.address.street);
          const number = data.numero || (data.address && data.address.number);
          const details = data.complemento || (data.address && data.address.details);
          const district = data.bairro || (data.address && data.address.district);

          const parts = [street, number, details, district].filter(Boolean);
          if (parts.length > 0) {
            newValues.endereco = parts.join(', ');
          }
        }

        console.log('📝 [ClienteForm] Novos valores para preenchimento:', newValues);
        setFormData(prev => ({ ...prev, ...newValues }));

        toast({
          title: "CNPJ Encontrado",
          description: "Dados do cadastro preenchidos automaticamente.",
        });

        if (situacao && situacao.toUpperCase() !== 'ATIVA') {
          toast({
            title: "Atenção: Situação Cadastral",
            description: `A empresa está com situação: ${situacao}`,
            variant: "warning"
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      setCnpjRegistryStatus('ERROR');
      toast({
        title: "Erro na consulta",
        description: "Não foi possível consultar o CNPJ. Você pode preencher manualmente.",
        variant: "destructive"
      });
    } finally {
      setIsCnpjCpfChecking(false);
    }
  }, [user?.id, toast, setFormData, manualEdits, formatMunicipio, id, isEditing, isCnpjCpfChecking]);

  const handleCnpjCpfBlur = useCallback(async (e) => {
    const value = e.target.value;
    const isValid = await validateAndCheckCnpjCpf(value);

    // Se for CNPJ válido e não estiver editando, busca os dados
    if (isValid && documentType === 'cnpj' && !isEditing) {
      fetchCnpjData(value);
    }
  }, [validateAndCheckCnpjCpf, fetchCnpjData, documentType, isEditing]);

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
        // 🔍 LOG CRÍTICO: Ver o valor RAW do banco ANTES de qualquer processamento
        console.log('🔍 [ClienteForm] Valor RAW do banco de dados:');
        console.log('  - cnpj_cpf do banco:', data.cnpj_cpf);
        console.log('  - Tipo:', typeof data.cnpj_cpf);
        console.log('  - Tamanho:', data.cnpj_cpf?.length);
        console.log('  - Valor desmascarado:', unmask(String(data.cnpj_cpf || '')));
        console.log('  - Tamanho desmascarado:', unmask(String(data.cnpj_cpf || '')).length);

        // ✅ CORREÇÃO: Merge inteligente entre auto-save e dados do banco
        const isAutoSaveEmpty = Object.values(formData).every(value =>
          value === '' || value === null || value === undefined
        );

        console.log('  - formData.cnpj_cpf antes do merge:', formData.cnpj_cpf);
        console.log('  - hasAutoSaveData:', hasAutoSaveData);
        console.log('  - isAutoSaveEmpty:', isAutoSaveEmpty);

        // ✅ CORREÇÃO CRÍTICA: Se o auto-save tem um valor diferente do banco e o ID é o mesmo,
        // significa que o auto-save está desatualizado. Usar os dados do banco e limpar o auto-save.
        const bankCnpjCpf = unmask(String(data.cnpj_cpf || ''));
        const autoSaveCnpjCpf = unmask(String(formData.cnpj_cpf || ''));

        // Se os valores são diferentes, o auto-save está desatualizado - usar dados do banco
        const autoSaveIsOutdated = hasAutoSaveData && bankCnpjCpf !== autoSaveCnpjCpf && bankCnpjCpf.length > 0;

        if (autoSaveIsOutdated) {
          console.log('⚠️ Auto-save desatualizado detectado! Limpando e usando dados do banco.');
          console.log('  - Valor do banco:', bankCnpjCpf);
          console.log('  - Valor do auto-save:', autoSaveCnpjCpf);
          // Limpar o auto-save desatualizado
          if (typeof window !== 'undefined') {
            localStorage.removeItem(autoSaveKey);
          }
        }

        const finalData = (isAutoSaveEmpty || !hasAutoSaveData || autoSaveIsOutdated) ? data : {
          ...data,        // Dados base do banco
          ...formData     // Preserva alterações do auto-save (tem prioridade)
        };

        console.log('  - finalData.cnpj_cpf após merge:', finalData.cnpj_cpf);

        // Detectar tipo de documento ANTES de atualizar o formData (síncrono)
        // Regra simples: 14 caracteres = CNPJ, 11 caracteres = CPF, 12 caracteres = Outro
        if (finalData.cnpj_cpf) {
          const originalValue = finalData.cnpj_cpf;
          const unmaskedValue = unmask(originalValue);

          console.log('🔍 [ClienteForm] Detecção de tipo de documento:');
          console.log('  - Valor original:', originalValue);
          console.log('  - Valor sem máscara:', unmaskedValue);
          console.log('  - Tamanho original:', originalValue.length);
          console.log('  - Tamanho sem máscara:', unmaskedValue.length);

          if (unmaskedValue.length === 14) {
            console.log('  ✅ Detectado: CNPJ (14 dígitos)');
            setDocumentType('cnpj');
          } else if (unmaskedValue.length === 11) {
            console.log('  ✅ Detectado: CPF (11 dígitos)');
            setDocumentType('cpf');
          } else if (unmaskedValue.length === 12) {
            console.log('  ✅ Detectado: Outro (12 dígitos)');
            setDocumentType('outro');
          }

          // Formatar o CNPJ/CPF antes de salvar no formData (garantir que está formatado)
          // IMPORTANTE: Usar o valor desmascarado para formatar, não o valor original
          if (unmaskedValue.length === 14) {
            // É CNPJ - formatar como CNPJ usando apenas os dígitos
            finalData.cnpj_cpf = formatCnpjCpf(unmaskedValue);
          } else if (unmaskedValue.length === 11) {
            // É CPF - formatar como CPF usando apenas os dígitos
            finalData.cnpj_cpf = formatCnpjCpf(unmaskedValue);
          } else if (unmaskedValue.length === 12) {
            // É Outro - manter apenas os dígitos, sem formatação
            finalData.cnpj_cpf = unmaskedValue;
          } else {
            // Tamanho desconhecido - manter original
            finalData.cnpj_cpf = originalValue;
          }
          console.log('  - Valor formatado:', finalData.cnpj_cpf);
        }

        // Atualizar formData com os dados formatados
        setFormData(finalData);

        // Carregar municípios imediatamente se houver estado
        if (finalData.estado) {
          fetchMunicipios(finalData.estado).then(municipios => {
            const options = [...municipios].sort((a, b) => a.label.localeCompare(b.label));

            // Se há um município nos dados mas não é código (nome legado), apenas avisar no console
            if (finalData.municipio && !options.find(opt => opt.value === finalData.municipio) && isNaN(finalData.municipio)) {
              console.warn('⚠️ [ClienteForm] Município legado detectado no fetch:', finalData.municipio);
            }

            setMunicipiosOptions(options);
          });
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
  }, [id, isEditing, toast, setFormData, hasAutoSaveData, fetchMunicipios, formData, autoSaveKey]);

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

  // Detectar automaticamente o tipo de documento baseado no número de caracteres
  // Regra simples: 14 caracteres = CNPJ, 11 caracteres = CPF, 12 caracteres = Outro
  // (apenas quando o usuário digita, não durante o carregamento inicial)
  useEffect(() => {
    // Não detectar durante o carregamento inicial (loading)
    if (loading || !formData.cnpj_cpf) return;

    const originalValue = formData.cnpj_cpf;
    const unmaskedValue = unmask(originalValue);

    // Verificar se o tamanho atual corresponde ao tipo de documento selecionado
    const expectedLength = documentType === 'cnpj' ? 14 : documentType === 'cpf' ? 11 : documentType === 'outro' ? 12 : null;

    // Se o tamanho já corresponde ao tipo atual, não fazer nada (respeitar a escolha do usuário)
    if (expectedLength !== null && unmaskedValue.length === expectedLength) {
      return;
    }

    console.log('🔍 [ClienteForm] useEffect - Detecção automática:');
    console.log('  - Valor no formData:', originalValue);
    console.log('  - Valor sem máscara:', unmaskedValue);
    console.log('  - Tamanho original:', originalValue.length);
    console.log('  - Tamanho sem máscara:', unmaskedValue.length);
    console.log('  - documentType atual:', documentType);
    console.log('  - Tamanho esperado para o tipo atual:', expectedLength);

    // ✅ MELHORIA: Detectar baseado apenas no tamanho, evitando falsos positivos durante a digitação
    if (unmaskedValue.length === 14 && documentType !== 'cnpj') {
      console.log('  ✅ Mudando para: CNPJ');
      setDocumentType('cnpj');
    } else if (unmaskedValue.length === 11 && documentType === 'outro') {
      // Se for 11 e estiver como 'outro', provavelmente é um CPF sendo digitado
      console.log('  ✅ Mudando para: CPF');
      setDocumentType('cpf');
    } else if (unmaskedValue.length === 12 && documentType === 'cpf') {
      // Se passar de 11, e não for CNPJ ainda, mudar para 'outro' apenas se não for o caminho para CNPJ
      // No nosso caso, vamos apenas mudar para CNPJ quando chegar em 14, 
      // e ficar como CPF ou Outro enquanto não atinge 14.
      // MAS, para evitar que a máscara de CPF trunque, se passar de 11, melhor mudar para 'cnpj' ou 'outro' temporariamente
      console.log('  ✅ Mudando para: Outro (tamanho > 11)');
      setDocumentType('outro');
    }
  }, [formData.cnpj_cpf, loading, isEditing, documentType, fetchCnpjData]); // Adicionado fetchCnpjData e dependências para auto-fetch do CNPJ

  // Auto-fetch CNPJ quando detectado 14 caracteres e for novo registro
  useEffect(() => {
    const unmaskedValue = unmask(formData.cnpj_cpf || '');
    if (unmaskedValue.length === 14 && documentType === 'cnpj' && !isEditing && !isCnpjCpfChecking && !cnpjRegistryStatus) {
      console.log('🚀 [ClienteForm] Auto-fetching CNPJ detectado...');
      fetchCnpjData(formData.cnpj_cpf);
    }
  }, [formData.cnpj_cpf, documentType, isEditing, isCnpjCpfChecking, cnpjRegistryStatus, fetchCnpjData]);


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
      } else if (formData.cnpj_cpf) {
        // Se há um valor e está mudando entre CPF e CNPJ, reformatar o valor
        const unmaskedValue = unmask(formData.cnpj_cpf);
        const expectedLength = type === 'cnpj' ? 14 : 11;

        // Se o valor não tem o tamanho esperado para o novo tipo, limpar
        // Caso contrário, reformatar com a máscara correta
        if (unmaskedValue.length === expectedLength) {
          // Reformatar com a máscara correta
          const formattedValue = formatCnpjCpf(unmaskedValue);
          setFormData((prev) => ({ ...prev, cnpj_cpf: formattedValue }));
        } else if (unmaskedValue.length > 0) {
          // Se o tamanho não corresponde, limpar para evitar formatação incorreta
          setFormData((prev) => ({ ...prev, cnpj_cpf: '' }));
        }
      }
    }
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

  const handleCepBlur = async (e) => {
    const cep = unmask(e.target.value);
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco: data.logradouro ? `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}` : prev.endereco,
            municipio: data.ibge || prev.municipio, // ✅ CORREÇÃO: Usar data.ibge em vez de data.localidade
            estado: data.uf || prev.estado
          }));

          toast({
            title: "CEP Encontrado",
            description: "Endereço preenchido automaticamente.",
          });
        } else {
          toast({
            title: "CEP não encontrado",
            description: "Verifique o número digitado.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
        toast({
          title: "Erro na busca",
          description: "Não foi possível consultar o CEP.",
          variant: "destructive"
        });
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Marcar campo como editado manualmente
    setManualEdits(prev => ({ ...prev, [name]: true }));

    // Limpar status da API se o documento mudar
    if (name === 'cnpj_cpf') {
      setCnpjRegistryStatus(null);
      setCnpjCpfError('');
    }
  };

  const handleMaskedChange = (value, field) => {
    if (field === 'cnpj_cpf') {
      setCnpjCpfError('');
      setCnpjRegistryStatus(null);
    } else if (field === 'telefone') {
      setTelefoneError('');
    }
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Marcar campo como editado manualmente apenas se não estiver no carregamento inicial
    if (hasFetchedInitialData.current && !loading) {
      setManualEdits(prev => ({ ...prev, [field]: true }));
    }
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

    // IMPORTANTE: Garantir que o valor não seja corrompido
    // Se o documentType é CNPJ mas o valor tem menos de 14 dígitos, há um problema
    if (documentType === 'cnpj' && unmaskedCnpjCpf.length !== 14) {
      console.error('⚠️ ERRO: CNPJ com tamanho incorreto!', {
        documentType,
        unmaskedCnpjCpf,
        length: unmaskedCnpjCpf.length,
        formDataValue: formData.cnpj_cpf
      });
      toast({
        title: 'Erro de validação',
        description: 'O CNPJ deve ter exatamente 14 dígitos. Verifique o valor digitado.',
        variant: 'destructive'
      });
      setSaving(false);
      return;
    }

    if (documentType === 'cpf' && unmaskedCnpjCpf.length !== 11) {
      console.error('⚠️ ERRO: CPF com tamanho incorreto!', {
        documentType,
        unmaskedCnpjCpf,
        length: unmaskedCnpjCpf.length,
        formDataValue: formData.cnpj_cpf
      });
      toast({
        title: 'Erro de validação',
        description: 'O CPF deve ter exatamente 11 dígitos. Verifique o valor digitado.',
        variant: 'destructive'
      });
      setSaving(false);
      return;
    }

    if (documentType === 'outro' && unmaskedCnpjCpf.length !== 12) {
      console.error('⚠️ ERRO: Código "Outro" com tamanho incorreto!', {
        documentType,
        unmaskedCnpjCpf,
        length: unmaskedCnpjCpf.length,
        formDataValue: formData.cnpj_cpf
      });
      toast({
        title: 'Erro de validação',
        description: 'O código "Outro" deve ter exatamente 12 dígitos. Verifique o valor digitado.',
        variant: 'destructive'
      });
      setSaving(false);
      return;
    }

    const dataToSave = {
      ...formData,
      cnpj_cpf: unmaskedCnpjCpf,
      telefone: unmask(formData.telefone),
      latitude: formData.latitude ? String(formData.latitude) : null,
      longitude: formData.longitude ? String(formData.longitude) : null,
      media_dias_coleta: formData.media_dias_coleta === '' ? null : parseInt(formData.media_dias_coleta, 10),
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

      // ✅ Registrar log da ação
      await logAction(isEditing ? `update_${personType}` : `create_${personType}`, {
        id: data.id,
        razao_social: data.razao_social,
        cnpj_cpf: data.cnpj_cpf
      });

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
            {cnpjRegistryStatus && !['ATIVA', 'DUPLICATE'].includes(cnpjRegistryStatus.toUpperCase()) && (() => {
              const status = cnpjRegistryStatus.toUpperCase();
              const isError = status === 'NOT_FOUND' || status === 'ERROR';

              const statusMap = {
                'NOT_FOUND': 'Inválido ou não encontrado',
                'ERROR': 'Erro na consulta',
                'INATIVA': 'Empresa Inativa',
                'SUSPENSA': 'Empresa Suspensa',
                'DUPLICATE': 'Já cadastrado no sistema'
              };

              const displayStatus = statusMap[status] || cnpjRegistryStatus;
              const alertClass = (isError || status === 'DUPLICATE')
                ? "bg-red-500/20 border-red-500/50 text-red-200"
                : "bg-yellow-500/20 border-yellow-500/50 text-yellow-200";

              return (
                <div className={`${alertClass} border p-3 rounded-xl flex items-center gap-2 mb-4 animate-pulse`}>
                  <Info className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Alerta de situação cadastral</p>
                    <p className="text-xs">Este CNPJ encontra-se em situação: <span className="underline font-semibold">{displayStatus}</span></p>
                  </div>
                </div>
              );
            })()}
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-3">
                  <div>
                    <Label className="text-sm md:text-xs mb-2 flex items-center gap-1">
                      Tipo de Documento <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 md:w-3 md:h-3 text-emerald-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            align="start"
                            className="bg-gray-800 text-white border-gray-700 text-xs max-w-xs z-50"
                            sideOffset={5}
                          >
                            <p className="font-semibold mb-1">Tipos de Documento:</p>
                            <p>• 11 caracteres (números) = CPF</p>
                            <p>• 14 caracteres (números) = CNPJ</p>
                            <p>• 12 caracteres (números) = Outro</p>
                            <p className="mt-1 text-gray-400 text-xs">A contagem considera apenas os números, sem pontos, traços e barras.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <div className="flex items-center gap-1 mb-2">
                      {isCnpjCpfChecking && <Loader2 className="w-3 h-3 md:w-3 md:h-3 animate-spin" />}
                    </div>
                    <RadioGroup
                      value={documentType}
                      onValueChange={handleDocumentTypeChange}
                      className="flex flex-row gap-4 mb-3"
                      disabled={isEditing}
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
                    <div>
                      {documentType === 'outro' ? (
                        <Input
                          ref={cnpjCpfInputRef}
                          id="cnpj_cpf"
                          name="cnpj_cpf"
                          value={formData.cnpj_cpf || ''}
                          readOnly
                          disabled={isEditing}
                          className={`w-full flex h-10 md:h-8 rounded-xl border ${cnpjCpfError ? 'border-red-500' : 'border-white/20'} bg-white/10 px-3 py-2 text-sm md:text-xs ring-offset-background cursor-not-allowed opacity-70`}
                        />
                      ) : (
                        <div className="relative group">
                          <IMaskInput
                            mask={documentType === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                            value={formData.cnpj_cpf || ''}
                            unmask={false}
                            onAccept={(value) => handleMaskedChange(String(value), 'cnpj_cpf')}
                            onBlur={handleCnpjCpfBlur}
                            placeholder={
                              documentType === 'cnpj'
                                ? '00.000.000/0000-00'
                                : '000.000.000-00'
                            }
                            className={`w-full flex h-10 md:h-8 rounded-xl border ${cnpjCpfError ? 'border-red-500' : 'border-white/20'} bg-white/5 px-3 py-2 text-sm md:text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm md:file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
                            inputRef={cnpjCpfInputRef}
                            disabled={isDocumentDisabled}
                          />
                        </div>
                      )}
                      {cnpjCpfError && <p className="text-red-500 text-sm md:text-xs mt-1">{cnpjCpfError}</p>}
                      {documentType === 'outro' && (
                        <p className="text-xs text-emerald-300 mt-1">Código gerado automaticamente</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2" style={{ height: '1.5rem' }}></div>
                    <Label htmlFor="telefone" className="text-sm md:text-xs flex items-center gap-1">
                      Telefone <span className="text-red-500">*</span>
                    </Label>
                    <div className="mt-3">
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
                    </div>
                    {telefoneError && <p className="text-red-500 text-sm md:text-xs mt-1">{telefoneError}</p>}
                  </div>
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

                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-4 gap-4 md:gap-3">
                  <div className="sm:col-span-1">
                    <Label htmlFor="cep" className="text-sm md:text-xs mb-1 block">CEP</Label>
                    <IMaskInput
                      mask="00000-000"
                      as={Input}
                      id="cep"
                      name="cep"
                      value={formData.cep || ''}
                      onAccept={(value) => handleMaskedChange(String(value), 'cep')}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      className="bg-white/5 border border-white/20 rounded-xl h-10 md:h-8 px-3 py-2 text-sm md:text-xs w-full"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <Label htmlFor="endereco" className="text-sm md:text-xs mb-1 block">Endereço</Label>
                    <Input
                      id="endereco"
                      name="endereco"
                      value={formData.endereco || ''}
                      onChange={handleChange}
                      placeholder={`Endereço d${article} ${titleLabel.toLowerCase()}`}
                      className="bg-white/5 border border-white/20 rounded-xl h-10 md:h-8 px-3 py-2 text-sm md:text-xs"
                    />
                  </div>
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

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 items-end">
                  <div className="md:col-span-2">
                    <Label className="text-[10px] md:text-[10px] text-emerald-400 block mb-1">Última Coleta</Label>
                    <Input
                      value={formData.data_ultima_coleta ? new Date(formData.data_ultima_coleta).toLocaleDateString('pt-BR') : 'Sem histórico'}
                      disabled
                      className="bg-white/5 border-white/20 rounded-xl h-8 text-[11px] opacity-80 cursor-not-allowed text-white"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Label htmlFor="media_dias_coleta" className="text-[10px] md:text-[10px] text-yellow-400 font-bold block mb-1">Média</Label>
                    <Input
                      id="media_dias_coleta"
                      name="media_dias_coleta"
                      type="number"
                      value={formData.media_dias_coleta || ''}
                      onChange={handleChange}
                      placeholder="Dias"
                      className="bg-white/10 border-yellow-500/30 rounded-xl h-8 text-[11px] text-white focus:border-yellow-500/60"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px] md:text-[10px] text-blue-400 block mb-1">Previsão</Label>
                    <Input
                      value={formData.proxima_coleta_prevista ? new Date(formData.proxima_coleta_prevista).toLocaleDateString('pt-BR') : 'Não estimada'}
                      disabled
                      className="bg-white/5 border-white/20 rounded-xl h-8 text-[11px] opacity-80 cursor-not-allowed text-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="latitude" className="text-[10px] md:text-[10px] block mb-1">Latitude</Label>
                    <Input
                      id="latitude"
                      name="latitude"
                      value={formData.latitude || ''}
                      disabled
                      className="bg-white/5 border-white/20 rounded-xl h-8 text-[11px] opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="longitude" className="text-[10px] md:text-[10px] block mb-1">Longitude</Label>
                    <Input
                      id="longitude"
                      name="longitude"
                      value={formData.longitude || ''}
                      disabled
                      className="bg-white/5 border-white/20 rounded-xl h-8 text-[11px] opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Button
                              type="button"
                              variant="outline"
                              className={`w-full ${!isMapCriteriaMet ? 'bg-blue-600/10 border-blue-500/30 text-blue-300/60' : 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/30'} rounded-xl h-8 flex items-center justify-center gap-2 text-[11px] transition-all`}
                              onClick={handleMapClick}
                            >
                              <MapPin className="w-4 h-4" />
                              Localização
                            </Button>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="bg-gray-800 text-white border-gray-700 text-[10px] text-center p-2 rounded-xl">
                          <p>É necessário preencher o <b>CPF/CNPJ</b> e o <b>Nome Fantasia</b> para usar o mapa.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
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
      </motion.div >
    </>
  );
};

export default ClienteForm;