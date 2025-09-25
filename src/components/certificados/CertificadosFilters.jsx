import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Loader2, X, Search } from 'lucide-react';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect'; // Reintroduzido

export function CertificadosFilters({
  selectedClientId, // Reintroduzido
  setSelectedClientId, // Reintroduzido
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 relative z-20"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
        <div className="relative">
          <ClienteSearchableSelect
            labelText="Cliente"
            value={selectedClientId}
            onChange={setSelectedClientId}
          />
        </div>

        <div>
          <label htmlFor="startDate" className="block text-white mb-2">Data Inicial</label>
          <DateInput id="startDate" date={startDate} setDate={setStartDate} />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-white mb-2">Data Final</label>
          <DateInput id="endDate" date={endDate} setDate={setEndDate} />
        </div>
      </div>
    </motion.div>
  );
}