import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ColetaStep1 } from '@/components/coletas/ColetaStep1';
import { ColetaStep2 } from '@/components/coletas/ColetaStep2';
import { ColetaStep3 } from '@/components/coletas/ColetaStep3';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { parseCurrency } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';
import { logAction } from '@/lib/logger';
import { useAutoSave } from '@/hooks/useAutoSave';
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime, toDate } from 'date-fns-tz';

// ✅ COMPONENTE ClienteSearchableSelect SEM FILTRO DE USER_ID
const ClienteSearchableSelect = ({ value, onSelect, className }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // ✅ BUSCAR TODOS OS CLIENTES SEM FILTRAR POR USER_ID
  useEffect(() => {
    const fetchClientes = async () => {
      if (debouncedSearchTerm.length < 2) {
        setClientes([]);
        return;
      }

      setLoading(true);
      try {
        const escapedSearchTerm = escapePostgrestLikePattern(debouncedSearchTerm);
        
        // ✅ BUSCA TODOS OS CLIENTES - SEM FILTRO DE USER_ID
        let query = supabase
          .from('clientes')
          .select('*')
          .or(`nome_fantasia.ilike.%${escapedSearchTerm}%,razao_social.ilike.%${escapedSearchTerm}%,cnpj_cpf.ilike.%${escapedSearchTerm}%`)
          .order('nome_fantasia')
          .limit(20);

        const { data, error } = await query;

        if (error) {
          console.error('Erro ao buscar clientes:', error);
          setClientes([]);
        } else {
          console.log('✅ Todos os clientes encontrados:', data?.length);
          setClientes(data || []);
        }
      } catch (error) {
        console.error('Erro na busca de clientes:', error);
        setClientes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, [debouncedSearchTerm]);

  // Buscar cliente selecionado quando value mudar
  useEffect(() => {
    const fetchSelectedCliente = async () => {
      if (!value) {
        setSelectedCliente(null);
        return;
      }

      try {
        // ✅ BUSCA CLIENTE SEM VERIFICAR USER_ID
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', value)
          .single();

        if (error) {
          console.error('Erro ao buscar cliente selecionado:', error);
          setSelectedCliente(null);
        } else {
          setSelectedCliente(data);
        }
      } catch (error) {
        console.error('Erro ao carregar cliente selecionado:', error);
        setSelectedCliente(null);
      }
    };

    fetchSelectedCliente();
  }, [value]);

  const handleSelect = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
      setSelectedCliente(cliente);
      onSelect(cliente);
      setOpen(false);
      setSearchTerm('');
    }
  };

  const displayValue = useMemo(() => {
    if (selectedCliente) {
      if (selectedCliente.nome_fantasia && selectedCliente.razao_social) {
        return `${selectedCliente.nome_fantasia} - ${selectedCliente.razao_social}`;
      }
      return selectedCliente.nome_fantasia || selectedCliente.razao_social || 'Cliente sem nome';
    }
    return "Selecione um cliente...";
  }, [selectedCliente]);

  const formatClienteDisplay = (cliente) => {
    const nomeFantasia = cliente.nome_fantasia || '';
    const razaoSocial = cliente.razao_social || '';
    const cnpjCpf = cliente.cnpj_cpf || '';
    
    let display = '';
    if (nomeFantasia && razaoSocial) {
      display = `${nomeFantasia} - ${razaoSocial}`;
    } else {
      display = nomeFantasia || razaoSocial || 'Cliente sem nome';
    }
    
    if (cnpjCpf) {
      display += ` (${cnpjCpf})`;
    }
    
    return display;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
            !selectedCliente && "text-white/60",
            className
          )}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-gray-900 border-gray-700 text-white">
        <Command className="bg-gray-900 text-white">
          <CommandInput
            placeholder="Buscar cliente por nome fantasia, razão social ou CNPJ/CPF..."
            value={searchTerm}
            onValueChange={setSearchTerm}
            className="text-white placeholder:text-white/60"
          />
          <CommandList className="bg-gray-800">
            <CommandEmpty className="py-6 text-center text-sm text-white/70">
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Buscando clientes...
                </div>
              ) : debouncedSearchTerm.length < 2 ? (
                "Digite pelo menos 2 caracteres para buscar"
              ) : (
                "Nenhum cliente encontrado"
              )}
            </CommandEmpty>
            <CommandGroup className="bg-gray-800">
              {clientes.map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  value={cliente.id}
                  onSelect={() => handleSelect(cliente.id)}
                  className="text-white hover:bg-gray-700 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedCliente?.id === cliente.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{formatClienteDisplay(cliente)}</span>
                    {cliente.endereco && (
                      <span className="text-sm text-white/60 truncate">
                        {cliente.endereco}
                        {cliente.municipio && `, ${cliente.municipio}`}
                        {cliente.estado && ` - ${cliente.estado}`}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const ColetaForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEditing = !!id;
  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');
  const [empresa, setEmpresa] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasFetchedInitialData = useRef(false);
  const [hasAutoSaveData, setHasAutoSaveData] = useState(false);

  // Buscar dados da empresa
  useEffect(() => {
    const fetchEmpresaData = async () => {
      try {
        const { data, error } = await supabase.from('empresa').select('id, nome_fantasia, razao_social, cnpj, telefone, email, endereco, logo_sistema_url, logo_documento_url, timezone, items_per_page, estado, municipio, assinatura_responsavel_url, nome_responsavel_assinatura, created_at, updated_at').single();
        if (error) {
          console.warn('Erro ao buscar dados da empresa:', error);
          setEmpresa({ 
            timezone: 'America/Sao_Paulo', 
            items_per_page: 25,
            nome_fantasia: 'Nome da Empresa',
            razao_social: 'Razão Social',
            cnpj: 'N/A',
            telefone: '',
            email: '',
            endereco: ''
          });
          setEmpresaTimezone('America/Sao_Paulo');
        } else {
          setEmpresa(data);
          setEmpresaTimezone(data.timezone || 'America/Sao_Paulo');
        }
      } catch (error) {
        console.error('Erro ao carregar empresa:', error);
        setEmpresa({ 
          timezone: 'America/Sao_Paulo', 
          items_per_page: 25,
          nome_fantasia: 'Nome da Empresa',
          razao_social: 'Razão Social',
          cnpj: 'N/A',
          telefone: '',
          email: '',
          endereco: ''
        });
        setEmpresaTimezone('America/Sao_Paulo');
      }
    };
    fetchEmpresaData();
  }, []);

  const autoSaveKey = id ? `autoSave_coletaForm_${id}` : 'autoSave_coletaForm_new';

  const getInitialColetaData = useCallback((currentEmpresaTimezone) => {
    const nowInEmpresaTimezone = utcToZonedTime(new Date(), currentEmpresaTimezone);
    return {
      cliente: '',
      cliente_id: null,
      cnpj_cpf: '',
      endereco: '',
      email: '',
      municipio: '',
      estado: '',
      telefone: '',
      data_coleta: nowInEmpresaTimezone,
      hora_coleta: format(nowInEmpresaTimezone, 'HH:mm'),
      fator: '6',
      tipo_coleta: 'Troca',
      quantidade_coletada: '',
      quantidade_entregue: 0,
      valor_compra: '1,20',
      total_pago: 0,
      data_lancamento: null,
      user_id: user?.id,
    };
  }, [user]);

  const processDateValue = useCallback((dateValue, defaultValue) => {
    if (typeof dateValue === 'string') {
      const parsed = parseISO(dateValue);
      return isValid(parsed) ? parsed : defaultValue;
    }
    return (dateValue instanceof Date && isValid(dateValue)) ? dateValue : defaultValue;
  }, []);

  const [rawColetaData, setRawColetaData, clearSavedData] = useAutoSave(
    autoSaveKey,
    getInitialColetaData('America/Sao_Paulo'),
    true
  );

  // Verificação do auto-save
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(autoSaveKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const initialData = getInitialColetaData(empresaTimezone);
          const hasUserChanges = Object.keys(parsed).some(key => {
            const savedValue = parsed[key];
            const initialValue = initialData[key];
            
            if (key === 'user_id') return false;
            
            if (savedValue !== initialValue) {
              if (typeof savedValue === 'string' && typeof initialValue === 'string') {
                return savedValue.trim() !== initialValue.trim();
              }
              return true;
            }
            return false;
          });
          setHasAutoSaveData(hasUserChanges);
        } catch (error) {
          setHasAutoSaveData(false);
        }
      } else {
        setHasAutoSaveData(false);
      }
    }
  }, [autoSaveKey, empresaTimezone, getInitialColetaData, currentStep]);

  const coletaData = useMemo(() => {
    const initialDataForDefault = getInitialColetaData(empresaTimezone);
    return {
      ...rawColetaData,
      data_coleta: processDateValue(rawColetaData.data_coleta, initialDataForDefault.data_coleta),
    };
  }, [rawColetaData, empresaTimezone, getInitialColetaData, processDateValue]);

  // Atualizar user_id sempre que o user mudar
  useEffect(() => {
    if (user?.id && rawColetaData.user_id !== user.id) {
      setRawColetaData(prev => ({ ...prev, user_id: user.id }));
    }
  }, [user, rawColetaData.user_id, setRawColetaData]);

  const fetchColeta = useCallback(async () => {
    if (!isEditing) {
      return;
    }

    const { data, error } = await supabase
      .from('coletas')
      .select('*, pessoa:clientes (*)')
      .eq('id', id)
      .single();

    if (error) {
      toast({ title: "Erro", description: "Coleta não encontrada.", variant: "destructive" });
      navigate('/app/coletas');
    } else {
      const fullDateUTC = new Date(data.data_coleta);
      const zonedDate = utcToZonedTime(fullDateUTC, empresaTimezone);
      const formattedTime = data.hora_coleta || format(zonedDate, 'HH:mm');

      const entryDataFromDB = {
        ...data,
        cliente: data.pessoa?.nome || data.cliente_nome,
        cliente_id: data.cliente_id,
        cnpj_cpf: data.pessoa?.cnpj_cpf,
        endereco: data.pessoa?.endereco,
        email: data.pessoa?.email,
        municipio: data.pessoa?.municipio,
        estado: data.pessoa?.estado,
        telefone: data.pessoa?.telefone,
        tipo_coleta: data.tipo_coleta,
        data_coleta: zonedDate.toISOString(),
        hora_coleta: formattedTime,
        valor_compra: String(data.valor_compra || '0').replace('.', ','),
        quantidade_coletada: String(data.quantidade_coletada || '').replace('.', ','),
      };

      setRawColetaData(prevFormData => {
        const isAutoSaveEmpty = Object.values(prevFormData).every(value => 
          value === '' || value === null || value === undefined || 
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0)
        );
        
        if (isAutoSaveEmpty || !hasAutoSaveData) {
          return entryDataFromDB;
        } else {
          return {
            ...entryDataFromDB,
            ...prevFormData
          };
        }
      });
    }
  }, [id, isEditing, navigate, setRawColetaData, toast, empresaTimezone, hasAutoSaveData]);

  useEffect(() => {
    if (isEditing && !hasFetchedInitialData.current) {
      const timer = setTimeout(() => {
        fetchColeta();
        hasFetchedInitialData.current = true;
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isEditing, fetchColeta]);

  useEffect(() => {
    if (id) {
      hasFetchedInitialData.current = false;
    }
  }, [id]);

  const nextStep = () => {
    setCurrentStep(prev => prev < 3 ? prev + 1 : prev);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev > 1 ? prev - 1 : prev);
  };

  const updateColetaData = (newData) => {
    setRawColetaData(prev => {
      const updated = { ...prev, ...newData };
      if (updated.data_coleta instanceof Date) {
        updated.data_coleta = updated.data_coleta.toISOString();
      }
      return updated;
    });
  };

  const handleSave = async (finalData, returnData = false) => {
    setIsSaving(true);
    
    try {
      const finalColetaData = { ...coletaData, ...finalData };
      
      // Verificar se user existe
      if (!user?.id) {
        const error = new Error('Usuário não autenticado');
        toast({ title: "Erro", description: error.message, variant: "destructive" });
        if (returnData) return { error };
        return;
      }

      // Verificar se o user_id existe na tabela auth.users antes de salvar
      // Isso previne erros de foreign key constraint
      try {
        const { data: authUser, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser?.user || authUser.user.id !== user.id) {
          console.error('DEBUG - Erro ao verificar usuário autenticado:', authError);
          const error = new Error('Usuário autenticado não encontrado. Por favor, faça login novamente.');
          toast({ title: "Erro de Autenticação", description: error.message, variant: "destructive" });
          if (returnData) return { error };
          return;
        }
      } catch (authCheckError) {
        console.error('DEBUG - Exceção ao verificar usuário:', authCheckError);
        const error = new Error('Não foi possível verificar a autenticação do usuário. Por favor, faça login novamente.');
        toast({ title: "Erro de Autenticação", description: error.message, variant: "destructive" });
        if (returnData) return { error };
        return;
      }

      let clienteId = finalColetaData.cliente_id;
      
      if (!finalColetaData.cliente_id) {
          const { data: cliente, error: clientError } = await supabase
          .from('clientes')
          .upsert({
              id: clienteId,
              nome: finalColetaData.cliente,
              nome_fantasia: finalColetaData.nome_fantasia,
              cnpj_cpf: finalColetaData.cnpj_cpf,
              email: finalColetaData.email,
              endereco: finalColetaData.endereco,
              municipio: finalColetaData.municipio,
              estado: finalColetaData.estado,
              telefone: finalColetaData.telefone,
              user_id: user.id
          }, { onConflict: 'cnpj_cpf', ignoreDuplicates: false })
          .select()
          .single();

          if (clientError) {
          toast({ title: "Erro ao salvar cliente", description: clientError.message, variant: "destructive" });
          if (returnData) return { error: clientError };
          return;
          }
          clienteId = cliente.id;
      }
      
      let combinedDateTimeString;
      if (finalColetaData.data_coleta instanceof Date && isValid(finalColetaData.data_coleta)) {
          combinedDateTimeString = `${format(finalColetaData.data_coleta, 'yyyy-MM-dd')} ${finalColetaData.hora_coleta}`;
      } else {
          console.error("ColetaForm.jsx - finalColetaData.data_coleta is invalid:", finalColetaData.data_coleta);
          toast({ title: "Erro de Data", description: "A data da coleta é inválida. Por favor, verifique.", variant: "destructive" });
          if (returnData) return { error: new Error("Invalid coleta date") };
          return;
      }
      
      const dateInCompanyTimezone = toDate(combinedDateTimeString, { timeZone: empresaTimezone });
      const utcDateISOString = dateInCompanyTimezone.toISOString();

      const coletaToSave = {
        id: isEditing ? finalColetaData.id : undefined,
        cliente_id: clienteId,
        cliente_nome: finalColetaData.cliente,
        data_coleta: utcDateISOString,
        hora_coleta: finalColetaData.hora_coleta,
        fator: parseInt(finalColetaData.fator, 10),
        tipo_coleta: finalColetaData.tipo_coleta,
        quantidade_coletada: parseCurrency(finalColetaData.quantidade_coletada),
        quantidade_entregue: finalColetaData.tipo_coleta === 'Troca' || finalColetaData.tipo_coleta === 'Doação' ? parseFloat(finalColetaData.quantidade_entregue) : null,
        valor_compra: finalColetaData.tipo_coleta === 'Compra' ? parseCurrency(finalColetaData.valor_compra) : null,
        total_pago: finalColetaData.tipo_coleta === 'Compra' ? parseCurrency(finalColetaData.total_pago) : null,
        data_lancamento: finalColetaData.data_lancamento,
        user_id: user.id,
        estado: finalColetaData.estado,
        municipio: finalColetaData.municipio,
      };

      console.log('DEBUG - Coleta a ser salva:', coletaToSave);

      const { data: savedData, error: coletaError } = await supabase
        .from('coletas')
        .upsert(coletaToSave)
        .select()
        .single();

      if (coletaError) {
        console.error('DEBUG - Erro ao salvar coleta:', coletaError);
        
        // Tratamento específico para erro de foreign key constraint
        let errorMessage = coletaError.message;
        if (coletaError.message?.includes('foreign key constraint') || coletaError.message?.includes('coletas_user_id_fkey')) {
          errorMessage = 'Erro ao salvar: O usuário não está registrado corretamente no sistema. Por favor, faça logout e login novamente, ou entre em contato com o administrador.';
        }
        
        toast({ 
          title: "Erro ao salvar coleta", 
          description: errorMessage, 
          variant: "destructive" 
        });
        if (returnData) return { error: coletaError };
        return;
      }

      // Criar recibo
      let reciboEntry = null;
      try {
        const { data: reciboData, error: reciboError } = await supabase
          .from('recibos')
          .upsert({ 
            coleta_id: savedData.id,
            assinatura_url: isEditing ? null : undefined
          }, { onConflict: 'coleta_id' })
          .select()
          .single();

        if (reciboError) {
          console.error('DEBUG - Erro ao salvar recibo:', reciboError);
          const { data: existingRecibo } = await supabase
            .from('recibos')
            .select('*')
            .eq('coleta_id', savedData.id)
            .single();
          
          reciboEntry = existingRecibo;
        } else {
          reciboEntry = reciboData;
        }
      } catch (reciboException) {
        console.error('DEBUG - Exceção ao salvar recibo:', reciboException);
        const { data: existingRecibo } = await supabase
          .from('recibos')
          .select('*')
          .eq('coleta_id', savedData.id)
          .single();
        
        reciboEntry = existingRecibo;
      }

      await logAction(isEditing ? 'update_coleta' : 'create_coleta', { 
        coleta_id: savedData.id, 
        cliente_nome: savedData.cliente_nome,
        numero_coleta: savedData.numero_coleta 
      });

      // Limpar auto-save após salvar com sucesso
      clearSavedData();
      setHasAutoSaveData(false);
      hasFetchedInitialData.current = false;

      toast({
        title: "Sucesso!",
        description: `Coleta ${isEditing ? 'atualizada' : 'registrada'} com sucesso.`,
        variant: "default"
      });

      if(returnData) {
        const { data: cliente } = await supabase.from('clientes').select('cnpj_cpf, endereco').eq('id', clienteId).single();
        const fullSavedData = {
          ...savedData,
          cnpj_cpf: cliente?.cnpj_cpf,
          endereco: cliente?.endereco,
          assinatura_url: reciboEntry?.assinatura_url || null
        };
        return { data: fullSavedData, error: null };
      }
      
      // Navegar para o recibo
      console.log('DEBUG - Navegando para recibo:', savedData.id);
      navigate(`/app/recibo/${savedData.id}`);
      
    } catch (error) {
      console.error('Erro no processo de salvamento:', error);
      toast({ 
        title: "Erro ao Salvar", 
        description: error.message, 
        variant: "destructive" 
      });
      
      if (returnData) return { error };
    } finally {
      setIsSaving(false);
    }
  };

  const steps = [
    { number: 1, name: 'Cadastro' },
    { number: 2, name: 'Quantidade' },
    { number: 3, name: 'Finalizar' },
  ];

  return (
    <>
      <Helmet>
        <title>{isEditing ? 'Editar' : 'Nova'} Coleta - Sistema de Coleta de Óleo</title>
      </Helmet>
      
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative text-center mb-8"
        >
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">
            {isEditing ? 'Editar Coleta' : 'Registrar Nova Coleta'}
          </h1>
          <p className="text-emerald-200 text-sm md:text-lg">
            Siga as etapas para registrar os dados da coleta.
            {hasAutoSaveData && (
              <span className="text-yellow-400 ml-2">(Alterações não salvas)</span>
            )}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center text-center w-20">
                  <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center font-bold transition-all duration-300 ${
                      currentStep >= step.number
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/20 text-white/60'
                    }`}
                  >
                    {step.number}
                  </div>
                  <p className={`mt-2 text-xs md:text-sm truncate ${currentStep >= step.number ? 'text-white' : 'text-white/60'}`}>{step.name}</p>
                </div>
                {index < steps.length - 1 && (
                   <div className={`flex-1 h-1 mx-1 md:mx-4 transition-all duration-300 ${currentStep > step.number ? 'bg-emerald-500' : 'bg-white/20'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <ColetaStep1
              key="step1"
              data={coletaData}
              onNext={nextStep}
              onUpdate={updateColetaData}
              isEditing={isEditing}
              empresaTimezone={empresaTimezone}
              hasAutoSaveData={hasAutoSaveData}
              clearSavedData={clearSavedData}
            />
          )}
          {currentStep === 2 && (
            <ColetaStep2
              key="step2"
              data={coletaData}
              onNext={nextStep}
              onBack={prevStep}
              onUpdate={updateColetaData}
              empresaTimezone={empresaTimezone}
              hasAutoSaveData={hasAutoSaveData}
              clearSavedData={clearSavedData}
            />
          )}
          {currentStep === 3 && (
            <ColetaStep3
              key="step3"
              data={coletaData}
              onBack={prevStep}
              onSave={handleSave}
              onUpdate={updateColetaData}
              clearSavedData={clearSavedData}
              empresaTimezone={empresaTimezone}
              collectorName={user?.email || 'Coletor'}
              hasAutoSaveData={hasAutoSaveData}
              isSaving={isSaving}
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default ColetaForm;