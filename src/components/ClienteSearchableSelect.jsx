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
  // New props for controlled search term
  searchTerm: controlledSearchTerm, // The search text from parent
  onSearchTermChange, // Callback to update parent's search text
  // ✅ NOVA PROP: Para formulários que precisam dos dados completos do cliente
  returnFullClientData = false, // Se true, passa objeto completo; se false, passa apenas ID
}) => {
  // Internal state for dropdown visibility and client list
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);

  // Use internal state for the input value if not controlled, otherwise use controlledSearchTerm
  const [internalSearchTerm, setInternalSearchTerm] = useState(controlledSearchTerm || '');

  // Sync internalSearchTerm with controlledSearchTerm
  useEffect(() => {
    setInternalSearchTerm(controlledSearchTerm || '');
  }, [controlledSearchTerm]);

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      // ✅ CORREÇÃO: Manter razao_social e nome_fantasia (estrutura correta)
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome_fantasia, razao_social, cnpj_cpf, municipio, estado')
        .order('razao_social', { ascending: true });

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
    // Set initial input value if a client is already selected
    if (value && clients.length > 0) {
      const selected = clients.find(c => c.id === value);
      if (selected) {
        // ✅ CORREÇÃO: Usar razao_social e nome_fantasia corretamente
        const displayValue = selected.nome_fantasia && selected.razao_social 
          ? `${selected.nome_fantasia} - ${selected.razao_social}`
          : selected.nome_fantasia || selected.razao_social || 'Nome não informado';
        setInternalSearchTerm(displayValue);
        onSearchTermChange && onSearchTermChange(displayValue);
      }
    } else if (!value && !controlledSearchTerm) {
      setInternalSearchTerm('');
      onSearchTermChange && onSearchTermChange('');
    }
  }, [value, clients, controlledSearchTerm, onSearchTermChange]);

  const filteredClients = useMemo(() => {
    if (!internalSearchTerm) return clients;
    return clients.filter(client =>
      (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(internalSearchTerm.toLowerCase())) ||
      (client.razao_social && client.razao_social.toLowerCase().includes(internalSearchTerm.toLowerCase())) ||
      (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(internalSearchTerm.toLowerCase()))
    );
  }, [clients, internalSearchTerm]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInternalSearchTerm(val);
    onSearchTermChange && onSearchTermChange(val);
    if (!val) {
      // Se está limpando o campo, passar null
      onChange(null);
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    // ✅ CORREÇÃO CRÍTICA: Se returnFullClientData é true, passar objeto completo
    // Se false, passar apenas o ID (compatibilidade com outros formulários)
    if (returnFullClientData) {
      onChange(client); // Passa objeto completo com id, razao_social, nome_fantasia, cnpj_cpf, etc.
    } else {
      onChange(client.id); // Passa apenas o ID (comportamento original)
    }
    
    // ✅ CORREÇÃO: Usar razao_social e nome_fantasia corretamente
    const displayValue = client.nome_fantasia && client.razao_social 
      ? `${client.nome_fantasia} - ${client.razao_social}`
      : client.nome_fantasia || client.razao_social || 'Nome não informado';
    setInternalSearchTerm(displayValue);
    onSearchTermChange && onSearchTermChange(displayValue);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null);
    setInternalSearchTerm('');
    onSearchTermChange && onSearchTermChange('');
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = (e) => {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        if (!value && internalSearchTerm && !clients.some(c => {
          // ✅ CORREÇÃO: Usar razao_social e nome_fantasia corretamente
          const clientDisplay = c.nome_fantasia && c.razao_social 
            ? `${c.nome_fantasia} - ${c.razao_social}`
            : c.nome_fantasia || c.razao_social || '';
          return clientDisplay === internalSearchTerm;
        })) {
          setInternalSearchTerm('');
          onSearchTermChange && onSearchTermChange('');
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
          value={internalSearchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-10"
          autoComplete="off"
          disabled={disabled || isLoading}
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {!isLoading && internalSearchTerm && (
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
                onMouseDown={() => handleSelect(client)}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">
                  {/* ✅ CORREÇÃO: Usar razao_social e nome_fantasia corretamente */}
                  {client.nome_fantasia && client.razao_social 
                    ? `${client.nome_fantasia} - ${client.razao_social}`
                    : client.nome_fantasia || client.razao_social || 'Nome não informado'}
                </div>
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