import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf } from '@/lib/utils';
import { motion } from 'framer-motion';

const ClienteSearchableSelect = ({
  labelText = "Cliente",
  value, // selected client ID
  onChange, // callback for when a client is selected (id)
  loading: parentLoading = false,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(''); // Use inputValue for the text input
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj_cpf, municipio, estado') // Added nome_fantasia
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setClients([]);
      } else {
        setClients(data || []);
      }
      setLoadingClients(false);
    };
    fetchClients();
  }, [toast]);

  useEffect(() => {
    // Set inputValue based on the 'value' prop (selected client ID)
    if (value && clients.length > 0) {
      const selected = clients.find(c => c.id === value);
      if (selected) {
        setInputValue(selected.nome_fantasia ? `${selected.nome} - ${selected.nome_fantasia}` : selected.nome);
      }
    } else if (!value) {
      setInputValue('');
    }
  }, [value, clients]);

  const filteredClients = useMemo(() => {
    if (!inputValue) return clients; // Filter based on inputValue
    return clients.filter(client =>
      client.nome.toLowerCase().includes(inputValue.toLowerCase()) ||
      (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(inputValue.toLowerCase())) || // Search by nome_fantasia
      (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(inputValue.toLowerCase()))
    );
  }, [clients, inputValue]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val); // Update inputValue
    if (value) { // If a client was previously selected, clear it when typing
      onChange(null);
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    onChange(client.id); // Update parent's selectedClientId
    setInputValue(client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome); // Update inputValue to selected client's name
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null); // Clear parent's selectedClientId
    setInputValue(''); // Clear inputValue
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = (e) => {
    // Delay hiding dropdown to allow click on item
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        // If no client is selected (value is null) AND there's text in the input
        // AND that text doesn't match any client, then clear the input.
        if (!value && inputValue && !clients.some(c => (c.nome_fantasia ? `${c.nome} - ${c.nome_fantasia}` : c.nome) === inputValue)) {
          setInputValue('');
        }
      }
    }, 100);
  };

  const isLoading = parentLoading || loadingClients;

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="client-search-select" className="block text-white mb-1 text-sm">{labelText}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="client-search-select"
          type="text"
          value={inputValue} // Always use inputValue for the input field
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-10"
          autoComplete="off"
          disabled={disabled || isLoading}
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {!isLoading && inputValue && ( // Use inputValue here
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showDropdown && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1"
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

export default ClienteSearchableSelect;