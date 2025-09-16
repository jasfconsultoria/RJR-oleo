import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { formatCnpjCpf, formatToISODate } from '@/lib/utils';
import { Loader2, X } from 'lucide-react';

const ClienteDropdown = ({
  clients,
  onSelect,
}) => {
  const filteredClients = useMemo(() => {
    return clients;
  }, [clients]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute z-50 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1"
    >
      {filteredClients.length > 0 ? (
        filteredClients.map(cliente => (
          <div
            key={cliente.id}
            onClick={() => onSelect(cliente)}
            className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
          >
            <div className="font-medium text-gray-900">{cliente.nome}</div>
            <div className="text-sm text-gray-600">
              {cliente.cnpj_cpf ? formatCnpjCpf(cliente.cnpj_cpf) : 'CNPJ/CPF não informado'} - {cliente.municipio}/{cliente.estado}
            </div>
          </div>
        ))
      ) : (
        <div className="p-3 text-center text-gray-500">Nenhum cliente encontrado.</div>
      )}
    </motion.div>
  );
};

export function CertificadosFilters({
  clients,
  selectedClientId,
  setSelectedClientId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  const [loadingClients, setLoadingClients] = useState(!clients || clients.length === 0);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);
  const [filteredClients, setFilteredClients] = useState([]);

  useEffect(() => {
    if (clients && clients.length > 0) {
      setLoadingClients(false);
      const selected = clients.find(c => c.id === selectedClientId);
      setInputValue(selected ? selected.nome : '');
      setFilteredClients(clients);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClienteSelect = (cliente) => {
    setSelectedClientId(cliente.id);
    setInputValue(cliente.nome);
    setShowDropdown(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    if (!value) {
      setSelectedClientId('');
      setFilteredClients(clients);
    } else {
      setFilteredClients(
        clients.filter(client =>
          client.nome.toLowerCase().includes(value.toLowerCase())
        )
      );
    }
    setShowDropdown(true);
  };
  
  const clearSelection = () => {
    setInputValue('');
    setSelectedClientId('');
    setShowDropdown(false);
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 relative z-20"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-end">
        <div className="relative" ref={containerRef}>
          <label htmlFor="cliente-search" className="block text-white mb-2">Cliente</label>
           <div className="relative">
            <Input
              id="cliente-search"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => setShowDropdown(true)}
              placeholder={loadingClients ? "Carregando clientes..." : "Buscar cliente..."}
              className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-emerald-400 rounded-xl pr-10"
              autoComplete="off"
              disabled={loadingClients}
            />
            {loadingClients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
            {!loadingClients && inputValue && (
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {showDropdown && !loadingClients && (
            <ClienteDropdown 
              clients={filteredClients} 
              onSelect={handleClienteSelect} 
            />
          )}
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