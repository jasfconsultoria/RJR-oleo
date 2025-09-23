import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search, User } from 'lucide-react'; // Adicionado User icon
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf } from '@/lib/utils';
import { motion } from 'framer-motion';

const CertificadoClientSearch = ({
  labelText = "Cliente",
  selectedClientData, // Objeto completo do cliente selecionado (vindo do formulário pai)
  onSelectClient,   // Callback para atualizar o cliente selecionado no formulário pai (recebe o objeto completo ou null)
  loading: parentLoading = false,
  disabled = false,
}) => {
  const [searchTerm, setSearchTerm] = useState(''); // Estado interno para o texto do input
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

  // Sincroniza o searchTerm com o cliente selecionado (vindo do pai)
  useEffect(() => {
    if (selectedClientData) {
      setSearchTerm(selectedClientData.nome_fantasia ? `${selectedClientData.nome} - ${selectedClientData.nome_fantasia}` : selectedClientData.nome);
    } else {
      setSearchTerm(''); // Limpa o input se nenhum cliente estiver selecionado
    }
  }, [selectedClientData]);

  // Filtra os clientes com base no searchTerm
  useEffect(() => {
    if (!searchTerm) {
      setFilteredClients(allClients);
    } else {
      const filtered = allClients.filter(client =>
        client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.nome_fantasia && client.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.cnpj_cpf && formatCnpjCpf(client.cnpj_cpf).toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredClients(filtered);
    }
  }, [searchTerm, allClients]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val); // Atualiza o estado interno do input
    if (selectedClientData) {
      onSelectClient(null); // Desseleciona o cliente no pai se o usuário começar a digitar
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    onSelectClient(client); // Passa o objeto completo do cliente para o pai
    setSearchTerm(client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome);
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
        if (!selectedClientData && searchTerm && !allClients.some(c => (c.nome_fantasia ? `${c.nome} - ${c.nome_fantasia}` : c.nome) === searchTerm)) {
          setSearchTerm('');
        }
      }
    }, 100);
  };

  const isLoading = parentLoading || loadingClients;

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="certificado-client-search" className="text-white flex items-center gap-2">
        <User className="w-4 h-4" /> {/* Ícone de usuário */}
        {labelText} <span className="text-red-500">*</span> {/* Título verde com asterisco */}
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="certificado-client-search"
          type="text"
          value={searchTerm} // Controlado pelo estado interno
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Digite para buscar...`}
          className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
          autoComplete="off"
          disabled={disabled || isLoading}
          required // Campo obrigatório
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {/* Removido o botão "X" para limpar, seguindo o comportamento da ColetaStep1 */}
      </div>

      {showDropdown && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 w-full bg-white rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1"
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