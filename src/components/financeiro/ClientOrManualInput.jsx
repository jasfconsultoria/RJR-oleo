import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf } from '@/lib/utils';
import { motion } from 'framer-motion';

const ClientOrManualInput = ({
  labelText,
  selectedClientId, // Controlled prop from parent
  onSelectClient,   // Callback for when a client is selected (id)
  clientName,       // Controlled prop for manual name input
  onClientNameChange, // Callback for manual name input
  cnpjCpf,          // Controlled prop for cnpj_cpf
  onCnpjCpfChange,  // Callback for cnpj_cpf change (manual input)
  refetchTrigger = 0,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(''); // Use inputValue for the text input
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj_cpf, municipio, estado') // Added nome_fantasia
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar clientes/fornecedores', description: error.message, variant: 'destructive' });
        setClients([]);
      } else {
        setClients(data || []);
      }
      setLoadingClients(false);
    };
    fetchClients();
  }, [toast, refetchTrigger]);

  useEffect(() => {
    // Update inputValue when selectedClientId or clientName prop changes
    if (selectedClientId && clients.length > 0) {
      const selected = clients.find(c => c.id === selectedClientId);
      if (selected) {
        setInputValue(selected.nome_fantasia ? `${selected.nome} - ${selected.nome_fantasia}` : selected.nome);
      }
    } else {
      setInputValue(clientName || ''); // Use clientName prop if no ID selected
    }
  }, [selectedClientId, clientName, clients]);

  const filteredClients = useMemo(() => {
    if (!inputValue) return clients;
    return clients.filter(client =>
      client.nome.toLowerCase().includes(inputValue.toLowerCase()) ||
      (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(inputValue.toLowerCase())) ||
      (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(inputValue.toLowerCase()))
    );
  }, [clients, inputValue]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    onClientNameChange(value); // Always update parent's clientName
    if (selectedClientId) {
      onSelectClient(null); // Deselect client if typing over a selected one
      onCnpjCpfChange(''); // Clear CNPJ/CPF if deselecting
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    onSelectClient(client.id);
    onClientNameChange(client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome);
    onCnpjCpfChange(client.cnpj_cpf || '');
    setInputValue(client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelectClient(null);
    onClientNameChange('');
    onCnpjCpfChange('');
    setInputValue('');
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = (e) => {
    setTimeout(() => {
      if (dropdownRef.current && !dropdownRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        // If no client is selected (selectedClientId is null) AND there's text in the input
        // AND that text doesn't match any client, then revert inputValue to clientName prop.
        if (!selectedClientId && inputValue && !clients.some(c => (c.nome_fantasia ? `${c.nome} - ${c.nome_fantasia}` : c.nome) === inputValue)) {
          setInputValue(clientName || '');
        }
      }
    }, 100);
  };

  return (
    <div className="relative">
      <Label htmlFor="client-search" className="block text-lg mb-1">{labelText} <span className="text-red-500">*</span></Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="client-search"
          type="text"
          value={inputValue} // Always use inputValue for the input field
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={loadingClients ? "Carregando..." : `Buscar ou digitar ${labelText.toLowerCase()}`}
          className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl pr-10"
          autoComplete="off"
          disabled={disabled}
          ref={inputRef}
        />
        {loadingClients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {!loadingClients && inputValue && ( // Use inputValue here
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showDropdown && !loadingClients && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1"
          ref={dropdownRef}
        >
          {filteredClients.length > 0 ? (
            filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => handleSelect(client)}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">{client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome}</div>
                <div className="text-sm text-gray-600">
                  {client.cnpj_cpf ? formatCnpjCpf(client.cnpj_cpf) : 'CNPJ/CPF não informado'} - {client.municipio}/{client.estado}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-gray-500">Nenhum {labelText.toLowerCase()} encontrado.</div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ClientOrManualInput;