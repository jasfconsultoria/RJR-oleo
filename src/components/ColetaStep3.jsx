import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, CheckCircle, Droplets, ArrowLeft, DollarSign } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf, parseCurrency, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { ReciboViewDialog } from '@/components/coletas/ReciboViewDialog';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz'; // Importar formatInTimeZone e utcToZonedTime

export function ColetaStep3({ data, onBack, onSave, onUpdate, clearSavedData, empresaTimezone, collectorName }) {
  const [resultadoFinal, setResultadoFinal] = useState('0,00');
  const [showReciboDialog, setShowReciboDialog] = useState(false);
  const [savedColeta, setSavedColeta] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const isCompra = data.tipo_coleta === 'Compra';
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data } = await supabase.from('empresa').select('*').single();
      setEmpresa(data);
    };
    fetchEmpresa();
  }, []);

  useEffect(() => {
    const qtd = parseCurrency(data.quantidade_coletada);
    if (isNaN(qtd)) {
      setResultadoFinal('0,00');
      return;
    }

    if (isCompra) {
      const valor = parseCurrency(data.valor_compra);
      const total = isNaN(valor) ? 0 : qtd * valor;
      setResultadoFinal(total.toFixed(2).replace('.', ','));
    } else {
      const fator = parseFloat(data.fator);
      const entrega = (isNaN(fator) || fator === 0) ? 0 : Math.floor(qtd / fator);
      setResultadoFinal(entrega.toString());
    }
  }, [data, isCompra]);

  const handleLancar = async () => {
    const dataLancamento = new Date().toISOString();
    
    const calculatedFinalData = { 
      ...(isCompra 
        ? { total_pago: resultadoFinal }
        : { quantidade_entregue: resultadoFinal }),
      data_lancamento: dataLancamento 
    };
    
    const updatedFullData = { ...data, ...calculatedFinalData };
    
    const { data: savedData, error } = await onSave(updatedFullData, true);
    
    if (error) {
       toast({ title: 'Erro ao salvar coleta', description: error.message, variant: 'destructive' });
       return;
    }

    // savedData agora já inclui a assinatura_url atualizada (null se foi editado)
    onUpdate(calculatedFinalData);
    setSavedColeta(savedData); 
    
    toast({
      title: "Coleta finalizada!",
      description: "Dados salvos. Compartilhe o link para assinatura."
    });
    
    setShowReciboDialog(true);
  };

  const finishProcess = () => {
    setShowReciboDialog(false);
    clearSavedData(); // Clear auto-saved data when the process is finished
    navigate('/app/coletas');
  };

  // Agora espera um objeto Date para dateObject
  const formatColetaDateTime = (dateObject, timeString, timezone) => {
    console.log('ColetaStep3 - formatColetaDateTime inputs:', { dateObject, timeString, timezone }); // DEBUG
    if (!dateObject || !timeString) {
      console.error("ColetaStep3 - Missing dateObject or timeString:", { dateObject, timeString });
      return 'N/A';
    }
    if (!(dateObject instanceof Date) || isNaN(dateObject.getTime())) {
      console.error("ColetaStep3 - Invalid Date object:", dateObject);
      return 'Data/Hora inválida';
    }
    try {
      // dateObject já está no fuso horário da empresa (definido em ColetaForm)
      const formattedDate = format(dateObject, 'dd/MM/yyyy', { locale: ptBR });
      return `${formattedDate} às ${timeString}`;
    } catch (e) {
      console.error("ColetaStep3 - Error formatting date/time for display:", e);
      return 'Data/Hora inválida';
    }
  };

  return (
    <>
      {showReciboDialog && savedColeta && empresa && (
        <ReciboViewDialog
          coleta={savedColeta}
          empresa={empresa}
          isOpen={showReciboDialog}
          onClose={finishProcess}
          empresaTimezone={empresaTimezone} // Passar o fuso horário
          collectorName={collectorName} // Passar o nome do coletor
        />
      )}
    
      <motion.div
        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
        transition={{ duration: 0.3 }} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 md:p-8"
      >
        <div className="mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-400" /> Etapa 3: Finalização
          </h2>
          <p className="text-emerald-200 text-sm md:text-base">Confirme os dados para concluir a coleta</p>
        </div>

        <div className="bg-white/5 rounded-lg p-4 md:p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Resumo Completo da Coleta</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
            <div><span className="text-emerald-300">Cliente:</span><span className="text-white ml-2">{data.cliente}</span></div>
            <div><span className="text-emerald-300">CNPJ/CPF:</span><span className="text-white ml-2">{formatCnpjCpf(data.cnpj_cpf)}</span></div>
            <div><span className="text-emerald-300">Telefone:</span><span className="text-white ml-2">{data.telefone || 'N/A'}</span></div>
            <div><span className="text-emerald-300">E-mail:</span><span className="text-white ml-2">{data.email || 'N/A'}</span></div>
            <div className="md:col-span-2"><span className="text-emerald-300">Endereço:</span><span className="text-white ml-2">{data.endereco}</span></div>
            <div><span className="text-emerald-300">Data/Hora:</span><span className="text-white ml-2">{formatColetaDateTime(data.data_coleta, data.hora_coleta, empresaTimezone)}</span></div>
            <div><span className="text-emerald-300">Tipo:</span><span className="text-white ml-2 font-bold">{data.tipo_coleta}</span></div>
            <div><span className="text-emerald-300">Qtd. Coletada:</span><span className="text-white ml-2 font-bold">{parseCurrency(data.quantidade_coletada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span></div>
            {!isCompra && <div><span className="text-emerald-300">Fator:</span><span className="text-white ml-2">{data.fator}</span></div>}
            {isCompra && <div><span className="text-emerald-300">Valor/kg:</span><span className="text-white ml-2 font-bold">{formatCurrency(parseCurrency(data.valor_compra))}</span></div>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="resultado_final" className="text-white flex items-center gap-2 text-lg">
              {isCompra ? <DollarSign className="w-5 h-5" /> : <Droplets className="w-5 h-5" />}
              {isCompra ? 'Total a Pagar' : 'Qtd. de Óleo Novo a Entregar'}
            </Label>
            <div className="relative">
              <Input id="resultado_final" type="text" value={isCompra ? formatCurrency(parseCurrency(resultadoFinal)) : `${resultadoFinal} litros`} readOnly
                className="bg-emerald-500/20 border-emerald-400/30 text-white text-lg py-4 pr-16 font-bold"
              />
            </div>
            <div className="bg-emerald-500/10 border border-emerald-400/20 rounded-lg p-4">
              <p className="text-emerald-200 text-sm">
                <strong>Cálculo:</strong> {isCompra 
                  ? `${parseCurrency(data.quantidade_coletada).toLocaleString('pt-BR')} kg × ${formatCurrency(parseCurrency(data.valor_compra))} = ${formatCurrency(parseCurrency(resultadoFinal))}`
                  : `${parseCurrency(data.quantidade_coletada).toLocaleString('pt-BR')} kg ÷ ${data.fator || 1} = ${resultadoFinal} litros`
                }
              </p>
               {!isCompra && <p className="text-xs text-emerald-200 mt-1">* Valor Arredondado.</p>}
            </div>
          </div>

          <div className="flex justify-between items-center pt-6">
            <Button type="button" onClick={onBack} variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>
            <Button onClick={handleLancar} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
              <CheckCircle className="w-5 h-5 mr-2" /> Lançar
            </Button>
          </div>
        </div>
      </motion.div>
    </>
  );
}