import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Droplets, Scale, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { parseCurrency, formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'; // Importar formatInTimeZone e zonedTimeToUtc

export function ColetaStep2({ data, onBack, onNext, onUpdate, empresaTimezone }) {
  const [quantidadeColetada, setQuantidadeColetada] = useState(data.quantidade_coletada || '');
  const { toast } = useToast();
  const isCompra = data.tipo_coleta === 'Compra';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!quantidadeColetada || parseCurrency(quantidadeColetada) <= 0) {
      toast({
        title: 'Campo obrigatório',
        description: 'Por favor, informe a quantidade de óleo coletado.',
        variant: 'destructive',
      });
      return;
    }
    onUpdate({ quantidade_coletada: quantidadeColetada });
    onNext();
  };

  const calcularResultado = () => {
    const qtd = parseCurrency(quantidadeColetada);
    if (isNaN(qtd)) return 0;

    if (isCompra) {
      const valor = parseCurrency(data.valor_compra);
      if (isNaN(valor)) return 0;
      return (qtd * valor);
    } else {
      const fator = parseFloat(data.fator);
      if (isNaN(fator) || fator === 0) return 0;
      return Math.floor(qtd / fator);
    }
  };

  const formatColetaDateTime = (dateString, timeString, timezone) => {
    if (!dateString || !timeString) return 'N/A';
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const [hour, minute] = timeString.split(':').map(Number);

      // Cria um objeto Date que representa a hora no fuso horário da empresa
      // new Date(year, month - 1, day, hour, minute) cria uma data no fuso horário local do navegador.
      // zonedTimeToUtc interpreta essa data local como se estivesse no 'timezone' fornecido e a converte para UTC.
      const dateInUTC = zonedTimeToUtc(new Date(year, month - 1, day, hour, minute), timezone);

      return formatInTimeZone(dateInUTC, timezone, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
      console.error("Error formatting date/time for display in Step 2:", e);
      return 'Data/Hora inválida';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-8"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <Scale className="w-6 h-6 text-emerald-400" />
          Etapa 2: Registro da Quantidade
        </h2>
        <p className="text-emerald-200">Informe os detalhes da coleta</p>
      </div>

      <div className="bg-white/5 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Resumo da Coleta</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-emerald-300">Cliente:</span><span className="text-white ml-2">{data.cliente || 'N/A'}</span></div>
          <div><span className="text-emerald-300">Data/Hora:</span><span className="text-white ml-2">{formatColetaDateTime(data.data_coleta, data.hora_coleta, empresaTimezone)}</span></div>
          <div><span className="text-emerald-300">Tipo:</span><span className="text-white ml-2 font-bold">{data.tipo_coleta || 'N/A'}</span></div>
          {!isCompra && <div><span className="text-emerald-300">Fator:</span><span className="text-white ml-2">{data.fator || 'N/A'}</span></div>}
          {isCompra && <div><span className="text-emerald-300">Valor/kg:</span><span className="text-white ml-2">{formatCurrency(parseCurrency(data.valor_compra))}</span></div>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="quantidade" className="text-white flex items-center gap-2 text-lg">
            <Droplets className="w-5 h-5" />
            Quantidade de Óleo Coletado (kg) *
          </Label>
          <div className="relative">
            <Input
              id="quantidade" type="text"
              value={quantidadeColetada} onChange={(e) => setQuantidadeColetada(e.target.value)}
              placeholder="Ex: 150,50"
              className="bg-white/20 border-white/30 text-white placeholder:text-white/60 text-lg py-4 pr-12"
            />
            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/60 font-medium">kg</span>
          </div>
        </div>

        {quantidadeColetada && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/20 border border-emerald-400/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-emerald-300 mb-2">
              <RefreshCw className="w-4 h-4" />
              <span className="font-medium">Prévia do Cálculo</span>
            </div>
            <div className="text-white">
              <p>Qtd. coletada: <span className="font-bold">{parseCurrency(quantidadeColetada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</span></p>
              {isCompra ? (
                <>
                  <p>Valor por kg: <span className="font-bold">{formatCurrency(parseCurrency(data.valor_compra))}</span></p>
                  <p className="text-emerald-300 font-bold text-lg">Total a Pagar: {formatCurrency(calcularResultado())}</p>
                </>
              ) : (
                <>
                  <p>Fator de conversão: <span className="font-bold">{data.fator}</span></p>
                  <p className="text-emerald-300 font-bold text-lg">Qtd. a entregar (óleo novo): {calcularResultado()} litros</p>
                  <p className="text-xs text-emerald-200 mt-1">* Valor Arredondado.</p>
                </>
              )}
            </div>
          </motion.div>
        )}

        <div className="flex justify-between items-center pt-6">
          <Button type="button" onClick={onBack} variant="outline" className="rounded-xl">
            <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
            Próximo →
          </Button>
        </div>
      </form>
    </motion.div>
  );
}