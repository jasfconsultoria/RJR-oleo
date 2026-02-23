import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Loader2, X, Search } from 'lucide-react';

export function CertificadosFilters({
  clientSearchTerm, // Novo prop
  setClientSearchTerm, // Novo prop
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  const handleInputChange = (e) => {
    const value = e.target.value;
    setClientSearchTerm(value); // Atualiza o termo de busca diretamente
  };
  
  const clearSearch = () => {
    setClientSearchTerm('');
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 relative z-20"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 items-end"> {/* Alterado para lg:grid-cols-5 */}
        <div className="relative lg:col-span-3"> {/* Ocupa 3 colunas em telas grandes */}
          <label htmlFor="cliente-search" className="block text-white mb-2">Cliente</label>
           <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              id="cliente-search"
              value={clientSearchTerm} // Usar clientSearchTerm
              onChange={handleInputChange}
              placeholder="Buscar cliente..."
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-emerald-400 rounded-xl pr-10"
              autoComplete="off"
            />
            {clientSearchTerm && ( // Mostrar botão de limpar apenas se houver texto
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full" onClick={clearSearch}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div> {/* Ocupa 1 coluna em telas grandes */}
          <label htmlFor="startDate" className="block text-white mb-2">Data Inicial</label>
          <DateInput id="startDate" date={startDate} setDate={setStartDate} />
        </div>
        <div> {/* Ocupa 1 coluna em telas grandes */}
          <label htmlFor="endDate" className="block text-white mb-2">Data Final</label>
          <DateInput id="endDate" date={endDate} setDate={setEndDate} />
        </div>
      </div>
    </motion.div>
  );
}