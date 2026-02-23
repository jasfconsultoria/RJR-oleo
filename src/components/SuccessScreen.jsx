import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { RotateCcw, FileText } from 'lucide-react';

export function SuccessScreen({ data, onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="mb-8"
      >
        <img  className="w-24 h-24 mx-auto mb-4" alt="Reciclagem e Meio Ambiente" src="https://horizons-cdn.hostinger.com/e9ffe4da-4240-4026-8d13-c9abf4d6315e/448e458cc943091e5613c0268f5e223c.png" />
        <h2 className="text-3xl font-bold text-white mb-2">
          Coleta Processada com Sucesso!
        </h2>
        <p className="text-emerald-200 text-lg">
          Todos os dados foram salvos e o processo foi concluído
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white/5 rounded-xl p-6 mb-8 text-left"
      >
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Resumo Final da Coleta
        </h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">ID da Coleta:</span>
            <span className="text-white font-mono">#{data.id}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">Cliente:</span>
            <span className="text-white">{data.cliente}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">Data da Coleta:</span>
            <span className="text-white">{new Date(data.data_coleta).toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">Tipo:</span>
            <span className="text-white">{data.tipo_coleta}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">Quantidade Coletada:</span>
            <span className="text-white font-bold">{data.quantidade_coletada} kg</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">Fator Aplicado:</span>
            <span className="text-white">{data.fator}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-2">
            <span className="text-emerald-300">Quantidade Entregue:</span>
            <span className="text-white font-bold text-emerald-300">{data.quantidade_entregue} L</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-300">Data/Hora do Lançamento:</span>
            <span className="text-white">{new Date(data.data_lancamento).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="space-y-4"
      >
        <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-4">
          <p className="text-emerald-200 text-sm">
            ✅ Dados salvos na tabela personalizada 'coleta_oleo'<br/>
            ✅ Formulário de assinatura WPForms gerado<br/>
            ✅ Recibo enviado para impressora térmica
          </p>
        </div>

        <Button
          onClick={onReset}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Nova Coleta
        </Button>
      </motion.div>
    </motion.div>
  );
}