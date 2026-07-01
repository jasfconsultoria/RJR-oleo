import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf, cn, matchesCnpjCpfSearch } from '@/lib/utils';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { motion } from 'framer-motion';
import { useLocationData } from '@/hooks/useLocationData';

const ClienteSearchableSelect = ({
  labelText = "Cliente",
  value,
  onChange,
  loading: parentLoading = false,
  disabled = false,
  searchTerm: controlledSearchTerm,
  onSearchTermChange,
  returnFullClientData = false,
  personType = 'cliente',
  className = "",
  inputRef: externalInputRef,
  clientListVersion = 0,
}) => {
  const { fetchMunicipiosByCodes } = useLocationData();
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);
  const internalInputRef = useRef(null);
  const isTypingRef = useRef(false);

  const inputRef = externalInputRef || internalInputRef;
  const [internalSearchTerm, setInternalSearchTerm] = useState(controlledSearchTerm || '');

  useEffect(() => {
    if (!isTypingRef.current && controlledSearchTerm !== undefined) {
      setInternalSearchTerm(controlledSearchTerm || '');
    }
  }, [controlledSearchTerm]);

  const enrichWithMunicipioNames = async (rawData) => {
    const codes = [...new Set(rawData.map(c => c.municipio).filter(m => m && !isNaN(m)))];
    if (codes.length > 0) {
      const mapping = await fetchMunicipiosByCodes(codes);
      return rawData.map(c => ({
        ...c,
        municipio_nome: mapping[c.municipio] || c.municipio
      }));
    }
    return rawData.map(c => ({
      ...c,
      municipio_nome: c.municipio
    }));
  };

  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);

      try {
        if (personType === 'coletor') {
          const { data: usuariosRPC, error: rpcError } = await supabase.rpc('get_all_users');

          let coletores = [];
          if (!rpcError && usuariosRPC) {
            coletores = usuariosRPC
              .filter(u => u.role === 'coletor' && u.status === 'ativo')
              .map(u => ({
                id: u.id,
                nome_fantasia: u.full_name || '',
                razao_social: u.full_name || '',
                cnpj_cpf: u.cpf || null,
                municipio: u.municipio || null,
                estado: u.estado || null,
                email: u.email || null,
                telefone: u.telefone || null,
                endereco: null
              }));
          } else {
            const { data, error } = await supabase
              .from('profiles')
              .select('id, full_name, email, municipio, estado, cpf, telefone')
              .eq('role', 'coletor')
              .eq('status', 'ativo');

            if (error) throw error;
            coletores = (data || []).map(u => ({
              id: u.id,
              nome_fantasia: u.full_name || '',
              razao_social: u.full_name || '',
              cnpj_cpf: u.cpf || null,
              municipio: u.municipio || null,
              estado: u.estado || null,
              email: u.email || null,
              telefone: u.telefone || null,
              endereco: null
            }));
          }

          const codes = [...new Set(coletores.map(u => u.municipio).filter(m => m && !isNaN(m)))];
          if (codes.length > 0) {
            const mapping = await fetchMunicipiosByCodes(codes);
            coletores = coletores.map(u => ({
              ...u,
              municipio_nome: mapping[u.municipio] || u.municipio
            }));
          } else {
            coletores = coletores.map(u => ({
              ...u,
              municipio_nome: u.municipio
            }));
          }

          coletores.sort((a, b) => {
            const nomeA = a.nome_fantasia || '';
            const nomeB = b.nome_fantasia || '';
            return nomeA.localeCompare(nomeB);
          });

          setClients(coletores);
        } else {
          const data = await fetchAllRows(
            () => supabase
              .from('clientes')
              .select('id, nome_fantasia, razao_social, cnpj_cpf, municipio, estado, email, telefone, endereco'),
            { order: { column: 'razao_social', ascending: true } }
          );

          const processedData = await enrichWithMunicipioNames(data);
          setClients(processedData);
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
        toast({
          title: `Erro ao buscar ${labelText.toLowerCase()}`,
          description: error.message,
          variant: 'destructive'
        });
        setClients([]);
      } finally {
        setLoadingClients(false);
      }
    };

    fetchClients();
  }, [toast, personType, labelText, fetchMunicipiosByCodes, clientListVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevPersonTypeRef = useRef(personType);
  useEffect(() => {
    const prevPersonType = prevPersonTypeRef.current;
    prevPersonTypeRef.current = personType;
    if (prevPersonType !== undefined && prevPersonType !== personType && value) {
      onChange(null);
      setInternalSearchTerm('');
      onSearchTermChange && onSearchTermChange('');
    }
  }, [personType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isTypingRef.current) return;

    if (value && clients.length > 0) {
      const selected = clients.find(c => c.id === value);
      if (selected) {
        const displayValue = selected.nome_fantasia && selected.razao_social
          ? `${selected.nome_fantasia} - ${selected.razao_social}`
          : selected.nome_fantasia || selected.razao_social || 'Nome não informado';

        if (internalSearchTerm !== displayValue) {
          setInternalSearchTerm(displayValue);
        }
      }
    } else if (!value && !controlledSearchTerm && internalSearchTerm !== '') {
      setInternalSearchTerm('');
    }
  }, [value, clients, controlledSearchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredClients = useMemo(() => {
    if (!internalSearchTerm.trim()) return clients;

    const searchLower = internalSearchTerm.toLowerCase().trim();
    const searchNumeric = internalSearchTerm.replace(/\D/g, '');
    const words = searchLower.split(/\s+/).filter(Boolean);

    return clients.filter(client => {
      const nome = (client.nome_fantasia || '').toLowerCase();
      const razao = (client.razao_social || '').toLowerCase();
      const combined = `${nome} ${razao}`.trim();

      const docRaw = client.cnpj_cpf || '';

      return words.every(word => (
          nome.includes(word) ||
          razao.includes(word) ||
          combined.includes(word) ||
          matchesCnpjCpfSearch(docRaw, word) ||
          (searchNumeric && matchesCnpjCpfSearch(docRaw, internalSearchTerm))
        ));
    });
  }, [clients, internalSearchTerm]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    isTypingRef.current = true;
    setInternalSearchTerm(val);
    onSearchTermChange && onSearchTermChange(val);
    if (!val) {
      onChange(null);
    }
    setShowDropdown(true);
  };

  const handleSelect = (client) => {
    if (returnFullClientData) {
      onChange(client);
    } else {
      onChange(client.id);
    }

    const displayValue = client.nome_fantasia && client.razao_social
      ? `${client.nome_fantasia} - ${client.razao_social}`
      : client.nome_fantasia || client.razao_social || 'Nome não informado';

    isTypingRef.current = false;
    setInternalSearchTerm(displayValue);
    onSearchTermChange && onSearchTermChange(displayValue);
    setShowDropdown(false);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleClear = () => {
    isTypingRef.current = false;
    onChange(null);
    setInternalSearchTerm('');
    onSearchTermChange && onSearchTermChange('');
    setShowDropdown(false);
  };

  const handleFocus = () => {
    setShowDropdown(true);
  };

  const handleBlur = () => {
    setTimeout(() => {
      isTypingRef.current = false;
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        if (!value && internalSearchTerm && !clients.some(c => {
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
          ref={inputRef}
          type="text"
          value={internalSearchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className={cn(
            "pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl pr-10 h-9 text-xs transition-all focus:border-emerald-400 focus:bg-white/30",
            className
          )}
          autoComplete="off"
          disabled={disabled}
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin pointer-events-none" />}
        {!isLoading && internalSearchTerm && (
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/70 hover:text-white rounded-full"
            onClick={handleClear}
          >
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
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(client);
                }}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">
                  {client.nome_fantasia && client.razao_social
                    ? `${client.nome_fantasia} - ${client.razao_social}`
                    : client.nome_fantasia || client.razao_social || 'Nome não informado'}
                </div>
                <div className="text-sm text-gray-600">
                  {personType === 'coletor' ? (
                    <>
                      {client.email ? `${client.email}` : 'E-mail não informado'}
                      {client.municipio && client.estado ? ` - ${client.municipio}/${client.estado}` : ''}
                    </>
                  ) : (
                    <>
                      {client.cnpj_cpf ? formatCnpjCpf(client.cnpj_cpf) : 'CNPJ/CPF não informado'} - {client.municipio_nome || client.municipio}/{client.estado}
                    </>
                  )}
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
