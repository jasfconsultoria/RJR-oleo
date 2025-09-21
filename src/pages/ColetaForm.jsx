import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ColetaStep1 } from '@/components/ColetaStep1';
import { ColetaStep2 } from '@/components/ColetaStep2';
import { ColetaStep3 } from '@/components/ColetaStep3';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { parseCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { logAction } from '@/lib/logger';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useProfile } from '@/contexts/ProfileContext';
import { formatInTimeZone, zonedTimeToUtc, utcToZonedTime, toDate } from 'date-fns-tz'; // Importar funções de fuso horário

const ColetaForm = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEditing = !!id;
  const { profile } = useProfile();
  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');

  useEffect(() => {
    const fetchEmpresaTimezone = async () => {
      const { data, error } = await supabase.from('empresa').select('timezone').single();
      if (data?.timezone) {
        setEmpresaTimezone(data.timezone);
      }
    };
    fetchEmpresaTimezone();
  }, []);

  const autoSaveKey = id ? `autoSave_coletaForm_${id}` : 'autoSave_coletaForm_new';

  // Define initial state for new forms, considering the company timezone
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
      data_coleta: nowInEmpresaTimezone, // Armazenar como objeto Date no fuso horário da empresa
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

  const [coletaData, setColetaData, clearSavedData] = useAutoSave(
    autoSaveKey,
    isEditing ? {} : getInitialColetaData('America/Sao_Paulo'), // Default para a primeira renderização
    !isEditing
  );

  // Efeito para re-hidratar data_coleta se for uma string (do localStorage)
  useEffect(() => {
    if (typeof coletaData.data_coleta === 'string' && !isNaN(new Date(coletaData.data_coleta))) {
      setColetaData(prev => ({ ...prev, data_coleta: new Date(prev.data_coleta) }));
    }
  }, [coletaData.data_coleta, setColetaData]);


  useEffect(() => {
    if (user?.id && coletaData.user_id !== user.id) {
      setColetaData(prev => ({ ...prev, user_id: user.id }));
    }
  }, [user, coletaData.user_id, setColetaData]);

  useEffect(() => {
    // Este useEffect garante que, se o empresaTimezone for carregado assincronamente,
    // ou se for um novo formulário, a data e a hora sejam definidas corretamente
    // para o fuso horário da empresa.
    if (empresaTimezone && !isEditing) {
      const nowInEmpresaTimezone = utcToZonedTime(new Date(), empresaTimezone);
      const currentFormattedTime = format(nowInEmpresaTimezone, 'HH:mm');

      // Atualiza apenas se os valores atuais não corresponderem ao tempo atual da empresa
      // ou se os campos de data/hora não estiverem definidos (indicando um formulário novo sem auto-save)
      if (!coletaData.data_coleta || format(coletaData.data_coleta, 'yyyy-MM-dd') !== format(nowInEmpresaTimezone, 'yyyy-MM-dd') || coletaData.hora_coleta !== currentFormattedTime) {
        setColetaData(prev => ({
          ...prev,
          data_coleta: nowInEmpresaTimezone, // Objeto Date
          hora_coleta: currentFormattedTime
        }));
      }
    }
  }, [empresaTimezone, isEditing, setColetaData, coletaData.data_coleta, coletaData.hora_coleta]);


  useEffect(() => {
    const fetchColeta = async () => {
      if (isEditing) {
        const { data, error } = await supabase
          .from('coletas')
          .select('*, pessoa:clientes (*)')
          .eq('id', id)
          .single();

        if (error) {
          toast({ title: "Erro", description: "Coleta não encontrada.", variant: "destructive" });
          navigate('/app/coletas');
        } else {
          // Converte a data UTC do DB para o fuso horário da empresa para preencher o formulário
          const fullDateUTC = new Date(data.data_coleta); // Data do DB é UTC
          const zonedDate = utcToZonedTime(fullDateUTC, empresaTimezone); // Converte para o fuso da empresa
          // A hora_coleta agora é lida diretamente do novo campo do DB
          const formattedTime = data.hora_coleta || format(zonedDate, 'HH:mm'); // Fallback se o campo ainda não existir no DB

          setColetaData((prev) => ({
            ...prev,
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
            data_coleta: zonedDate, // Armazenar como objeto Date
            hora_coleta: formattedTime, // Hora separada (do novo campo do DB)
            valor_compra: String(data.valor_compra || '0').replace('.', ','),
            quantidade_coletada: String(data.quantidade_coletada || '').replace('.', ','),
          }));
        }
      }
    };
    fetchColeta();
  }, [id, isEditing, navigate, setColetaData, toast, empresaTimezone]); // Adicionado empresaTimezone como dependência

  const nextStep = () => {
    setCurrentStep(prev => prev < 3 ? prev + 1 : prev);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev > 1 ? prev - 1 : prev);
  };

  const updateColetaData = (newData) => {
    setColetaData(prev => ({ ...prev, ...newData }));
  };

  const handleSave = async (finalData, returnData = false) => {
    const finalColetaData = { ...coletaData, ...finalData };
    
    let clienteId = finalColetaData.cliente_id;
    
    if (!finalColetaData.cliente_id) {
        const { data: cliente, error: clientError } = await supabase
        .from('clientes')
        .upsert({
            id: clienteId,
            nome: finalColetaData.cliente,
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
    
    // Combinar data_coleta (objeto Date no fuso horário da empresa) e hora_coleta (string HH:mm)
    // para criar um objeto Date que representa a data e hora no fuso horário da empresa.
    let combinedDateTimeString;
    if (finalColetaData.data_coleta instanceof Date && !isNaN(finalColetaData.data_coleta.getTime())) {
        combinedDateTimeString = `${format(finalColetaData.data_coleta, 'yyyy-MM-dd')} ${finalColetaData.hora_coleta}`;
    } else {
        console.error("ColetaForm.jsx - finalColetaData.data_coleta is invalid:", finalColetaData.data_coleta);
        toast({ title: "Erro de Data", description: "A data da coleta é inválida. Por favor, verifique.", variant: "destructive" });
        if (returnData) return { error: new Error("Invalid coleta date") };
        return;
    }
    
    const dateInCompanyTimezone = toDate(combinedDateTimeString, { timeZone: empresaTimezone });
    
    // Converter para ISO string (UTC) para salvar na coluna data_coleta do banco de dados
    const utcDateISOString = dateInCompanyTimezone.toISOString();

    const coletaToSave = {
      id: isEditing ? finalColetaData.id : undefined,
      cliente_id: clienteId,
      cliente_nome: finalColetaData.cliente,
      data_coleta: utcDateISOString, // Salvar como ISO string UTC
      hora_coleta: finalColetaData.hora_coleta, // Salvar a string HH:mm exata
      fator: parseInt(finalColetaData.fator, 10),
      tipo_coleta: finalColetaData.tipo_coleta,
      quantidade_coletada: parseCurrency(finalColetaData.quantidade_coletada),
      quantidade_entregue: finalColetaData.quantidade_entregue ? parseFloat(finalColetaData.quantidade_entregue) : null,
      valor_compra: finalColetaData.valor_compra ? parseCurrency(finalColetaData.valor_compra) : null,
      total_pago: finalColetaData.total_pago ? parseCurrency(finalColetaData.total_pago) : null,
      data_lancamento: finalColetaData.data_lancamento,
      user_id: user.id,
      estado: finalColetaData.estado,
      municipio: finalColetaData.municipio,
    };

    const { data: savedData, error: coletaError } = await supabase.from('coletas').upsert(coletaToSave).select().single();

    if (coletaError) {
      toast({ title: "Erro ao salvar coleta", description: coletaError.message, variant: "destructive" });
      if (returnData) return { error: coletaError };
      return;
    }

    // Após salvar a coleta, crie ou atualize a entrada na tabela 'recibos'
    // Se estiver editando, a assinatura_url deve ser explicitamente definida como null
    const { data: reciboEntry, error: reciboError } = await supabase
      .from('recibos')
      .upsert({ 
        coleta_id: savedData.id,
        assinatura_url: isEditing ? null : undefined // Se estiver editando, reseta a assinatura
      }, { onConflict: 'coleta_id' })
      .select()
      .single();

    if (reciboError) {
      toast({ title: 'Erro ao preparar recibo', description: reciboError.message, variant: 'destructive' });
      return;
    }

    await logAction(isEditing ? 'update_coleta' : 'create_coleta', { 
      coleta_id: savedData.id, 
      cliente_nome: savedData.cliente_nome,
      numero_coleta: savedData.numero_coleta 
    });

    if(returnData) {
      const { data: cliente } = await supabase.from('clientes').select('cnpj_cpf, endereco').eq('id', clienteId).single();
      const fullSavedData = {
        ...savedData,
        cnpj_cpf: cliente?.cnpj_cpf,
        endereco: cliente?.endereco,
        assinatura_url: reciboEntry.assinatura_url // Inclui a URL da assinatura do recibo, que pode ser null agora
      };
      return { data: fullSavedData, error: null };
    }
    
    navigate('/app/coletas');
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
              profile={profile}
              empresaTimezone={empresaTimezone} // Passar o fuso horário
            />
          )}
          {currentStep === 2 && (
            <ColetaStep2
              key="step2"
              data={coletaData}
              onNext={nextStep}
              onBack={prevStep}
              onUpdate={updateColetaData}
              empresaTimezone={empresaTimezone} // Passar o fuso horário
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
              empresaTimezone={empresaTimezone} // Passar o fuso horário
              collectorName={profile?.full_name || user?.email} // Passar o nome do coletor
            />
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default ColetaForm;