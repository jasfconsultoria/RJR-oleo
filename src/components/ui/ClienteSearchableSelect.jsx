import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCnpjCpf } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const ClienteSearchableSelect = ({ value, onChange, disabled = false, labelText = "Cliente", required = false }) => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchClientes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, cnpj_cpf, municipio, estado')
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar clientes', description: error.message, variant: 'destructive' });
        setClientes([]);
      } else {
        setClientes(data || []);
      }
      setLoading(false);
    };

    fetchClientes();
  }, [toast]);

  useEffect(() => {
    if (clientes.length > 0) {
      const selectedCliente = clientes.find(c => c.id === value);
      if (selectedCliente) {
        setInputValue(selectedCliente.nome);
      } else {
        setInputValue('');
      }
    }
  }, [value, clientes]);

  const filteredClientes = useMemo(() => {
    if (!inputValue) {
      return clientes;
    }
    return clientes.filter(cliente =>
      cliente.nome.toLowerCase().includes(inputValue.toLowerCase()) ||
      (cliente.cnpj_cpf && cliente.cnpj_cpf.includes(inputValue))
    );
  }, [inputValue, clientes]);

  const handleSelect = (cliente) => {
    onChange(cliente.id);
    setInputValue(cliente.nome);
    setShowDropdown(false);
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (!e.target.value) {
      onChange(null);
    }
    setShowDropdown(true);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="cliente-searchable-select" className="block text-white mb-1 text-sm">{labelText} {required && '*'}</Label>
      <div className="relative">
        <Input
          id="cliente-searchable-select"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          placeholder={loading ? "Carregando clientes..." : "Digite para buscar..."}
          className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:ring-emerald-400 rounded-xl pr-10"
          autoComplete="off"
          disabled={disabled || loading}
          required={required}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
      </div>
      
      {showDropdown && !disabled && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-50 w-full bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto mt-1"
        >
          {filteredClientes.length > 0 ? filteredClientes.map((cliente) => (
            <div
              key={cliente.id}
              onClick={() => handleSelect(cliente)}
              className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{cliente.nome}</div>
              <div className="text-sm text-gray-600">
                {cliente.cnpj_cpf ? formatCnpjCpf(cliente.cnpj_cpf) : 'CNPJ/CPF não informado'} - {cliente.municipio}/{cliente.estado}
              </div>
            </div>
          )) : (
            <div className="p-3 text-center text-gray-500">
              {loading ? "Carregando..." : "Nenhum cliente encontrado."}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ClienteSearchableSelect;