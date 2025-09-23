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
  const [searchTerm, setSearchTerm] = useState('');
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

  // Effect to synchronize internal searchTerm with the external 'value' prop
  useEffect(() => {
    if (value && clients.length > 0) {
      const selected = clients.find(c => c.id === value);
      if (selected) {
        const displayName = selected.nome_fantasia ? `${selected.nome} - ${selected.nome_fantasia}` : selected.nome;
        if (searchTerm !== displayName) { // Only update if different to avoid unnecessary re-renders
          setSearchTerm(displayName);
        }
      } else {
        // If value is set but client not found (e.g., client deleted), clear search term and notify parent
        setSearchTerm('');
        onChange(null); 
      }
    } else if (!value && searchTerm !== '') {
      // If value is null (no client selected) and searchTerm is not empty, clear it.
      setSearchTerm('');
    }
  }, [value, clients, onChange]);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    return clients.filter(client =>
      client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())) || // Search by nome_fantasia
      (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [clients, searchTerm]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    // If there's a selected client (value is not null) and the input value
    // is no longer the display name of that selected client, then clear the selection in the parent.
    const selectedClientDisplayName = value ? (clients.find(c => c.id === value)?.nome_fantasia ? `${clients.find(c => c.id === value).nome} - ${clients.find(c => c.id === value).nome_fantasia}` : clients.find(c => c.id === value)?.nome) : '';
    if (value && val !== selectedClientDisplayName) {
      onChange(null); 
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    onChange(client.id); // Update parent's state
    const displayName = client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome;
    setSearchTerm(displayName); // Update internal state immediately for responsiveness
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null); // Clear parent's state
    setSearchTerm(''); // Clear internal state immediately
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = () => {
    // Delay hiding dropdown to allow click on item
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        const selectedClient = clients.find(c => c.id === value);
        const selectedClientDisplayName = selectedClient ? (selectedClient.nome_fantasia ? `${selectedClient.nome} - ${selectedClient.nome_fantasia}` : selectedClient.nome) : '';

        if (value && searchTerm !== selectedClientDisplayName) {
          // If a client is selected but the input text doesn't match, revert to selected client's name
          setSearchTerm(selectedClientDisplayName);
        } else if (!value && searchTerm !== '') {
          // If no client is selected and there's text in the input, clear it
          setSearchTerm('');
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
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-10"
          autoComplete="off"
          disabled={disabled || isLoading}
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {!isLoading && searchTerm && (
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