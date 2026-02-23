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
  selectedClientId,
  onSelectClient,
  clientName,
  onClientNameChange,
  cnpjCpf,
  onCnpjCpfChange,
  refetchTrigger = 0,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isClienteSelected, setIsClienteSelected] = useState(false);
  const { toast } = useToast();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj_cpf, municipio, estado')
        .order('razao_social', { ascending: true });

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
    // Atualizar inputValue quando selectedClientId mudar
    if (selectedClientId && clients.length > 0) {
      const selected = clients.find(c => c.id === selectedClientId);
      if (selected) {
        const displayName = selected.nome_fantasia ? `${selected.razao_social} - ${selected.nome_fantasia}` : selected.razao_social;
        setInputValue(displayName);
        setIsClienteSelected(true);
      }
    } else {
      setInputValue(clientName || '');
      setIsClienteSelected(false);
    }
  }, [selectedClientId, clientName, clients]);

  // CORREÇÃO: Mostrar TODOS os clientes quando não há filtro (igual ao Crédito/Débito)
  const filteredClients = useMemo(() => {
    if (!inputValue) return clients; // Mostra todos quando não há filtro
    return clients.filter(client =>
      client.razao_social.toLowerCase().includes(inputValue.toLowerCase()) ||
      (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(inputValue.toLowerCase())) ||
      (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(inputValue.toLowerCase()))
    );
  }, [clients, inputValue]);

  // CORREÇÃO: Simplificar a lógica de mudança do input
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    // Se estiver digitando e havia um cliente selecionado, limpar a seleção
    if (isClienteSelected && value !== inputValue) {
      onSelectClient(null);
      onCnpjCpfChange('');
      setIsClienteSelected(false);
    }

    // Sempre atualizar o nome no parent
    onClientNameChange(value);
    setShowDropdown(true);
  };

  // CORREÇÃO: Garantir que todos os dados sejam atualizados corretamente
  const handleSelect = (client) => {
    const displayName = client.nome_fantasia ? `${client.razao_social} - ${client.nome_fantasia}` : client.razao_social;

    onSelectClient(client.id);
    onClientNameChange(displayName);
    onCnpjCpfChange(client.cnpj_cpf || '');
    setInputValue(displayName);
    setShowDropdown(false);
    setIsClienteSelected(true);
  };

  const handleClear = () => {
    onSelectClient(null);
    onClientNameChange('');
    onCnpjCpfChange('');
    setInputValue('');
    setShowDropdown(false);
    setIsClienteSelected(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  // CORREÇÃO: Simplificar o handleBlur
  const handleBlur = (e) => {
    setTimeout(() => {
      // Verificar se o foco não foi para o dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(document.activeElement)) {
        setShowDropdown(false);

        // Se não há cliente selecionado e o texto não corresponde a nenhum cliente, limpar
        if (!isClienteSelected && inputValue) {
          const isMatch = clients.some(client =>
            (client.nome_fantasia ? `${client.razao_social} - ${client.nome_fantasia}` : client.razao_social) === inputValue
          );
          if (!isMatch) {
            setInputValue('');
            onClientNameChange('');
          }
        }
      }
    }, 200);
  };

  return (
    <div className="relative">
      <Label htmlFor="client-search" className="block text-lg mb-1">{labelText} <span className="text-red-500">*</span></Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="client-search"
          type="text"
          value={inputValue}
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
        {!loadingClients && inputValue && (
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
                <div className="font-medium text-gray-900">
                  {client.nome_fantasia ? `${client.razao_social} - ${client.nome_fantasia}` : client.razao_social}
                </div>
                <div className="text-sm text-gray-600">
                  {client.cnpj_cpf ? formatCnpjCpf(client.cnpj_cpf) : 'CNPJ/CPF não informado'} - {client.municipio}/{client.estado}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-gray-500">
              {inputValue ? `Nenhum ${labelText.toLowerCase()} encontrado.` : `Nenhum ${labelText.toLowerCase()} cadastrado.`}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ClientOrManualInput;