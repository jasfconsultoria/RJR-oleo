import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf } from '@/lib/utils';
import { motion } from 'framer-motion';

const CertificadoClientSearch = ({
  labelText = "Cliente",
  selectedClientId, // ID do cliente selecionado (vindo do formulário pai)
  onSelectClient,   // Callback para atualizar o cliente selecionado no formulário pai
  loading: parentLoading = false,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(''); // Estado interno para o texto do input
  const [allClients, setAllClients] = useState([]); // Todos os clientes do DB
  const [filteredClients, setFilteredClients] = useState([]); // Clientes filtrados pela busca
  const [loadingClients, setLoadingClients] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);

  // Busca todos os clientes
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, nome_fantasia, cnpj_cpf, municipio, estado')
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setAllClients([]);
      } else {
        setAllClients(data || []);
      }
      setLoadingClients(false);
    };
    fetchClients();
  }, [toast]);

  // Sincroniza o inputValue com o cliente selecionado (vindo do pai)
  useEffect(() => {
    if (selectedClientId && allClients.length > 0) {
      const selected = allClients.find(c => c.id === selectedClientId);
      if (selected) {
        setInputValue(selected.nome_fantasia ? `${selected.nome} - ${selected.nome_fantasia}` : selected.nome);
      }
    } else if (!selectedClientId) {
      setInputValue(''); // Limpa o input se nenhum cliente estiver selecionado
    }
  }, [selectedClientId, allClients]);

  // Filtra os clientes com base no inputValue
  useEffect(() => {
    if (!inputValue) {
      setFilteredClients(allClients);
    } else {
      const filtered = allClients.filter(client =>
        client.nome.toLowerCase().includes(inputValue.toLowerCase()) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(inputValue.toLowerCase())) ||
        (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(inputValue.toLowerCase()))
      );
      setFilteredClients(filtered);
    }
  }, [inputValue, allClients]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val); // Atualiza o estado interno do input
    if (selectedClientId) {
      onSelectClient(null); // Desseleciona o cliente no pai se o usuário começar a digitar
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    onSelectClient(client); // Passa o objeto completo do cliente para o pai
    setInputValue(client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome);
    setShowDropdown(false);
  };

  const handleClear = () => {
    onSelectClient(null); // Limpa o cliente no pai
    setInputValue(''); // Limpa o input
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = () => {
    // Pequeno atraso para permitir cliques nos itens do dropdown
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        // Se não houver cliente selecionado no pai e o input não estiver vazio,
        // e o texto não corresponder a um cliente existente, limpa o input.
        if (!selectedClientId && inputValue && !allClients.some(c => (c.nome_fantasia ? `${c.nome} - ${c.nome_fantasia}` : c.nome) === inputValue)) {
          setInputValue('');
        }
      }
    }, 100);
  };

  const isLoading = parentLoading || loadingClients;

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="certificado-client-search" className="block text-white mb-1 text-sm">{labelText}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="certificado-client-search"
          type="text"
          value={inputValue} // Controlado pelo estado interno
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-10"
          autoComplete="off"
          disabled={disabled || isLoading}
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {!isLoading && inputValue && (
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

export default CertificadoClientSearch;