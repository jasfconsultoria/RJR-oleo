import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { formatCnpjCpf } from '@/lib/utils';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ColetaSearchableSelect = ({
  labelText = "Nº Coleta",
  value, // selected coleta ID
  onChange, // callback for when a coleta is selected (full coleta object)
  loading: parentLoading = false,
  disabled = false,
  hideLabel = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [coletas, setColetas] = useState([]);
  const [loadingColetas, setLoadingColetas] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchColetas = async () => {
      setLoadingColetas(true);
      const { data, error } = await supabase
        .from('coletas')
        .select('id, numero_coleta, data_coleta, cliente_id, cliente_nome, cnpj_cpf, endereco, municipio, estado')
        .order('numero_coleta', { ascending: false });

      if (error) {
        toast({ title: 'Erro ao buscar coletas', description: error.message, variant: 'destructive' });
        setColetas([]);
      } else {
        setColetas(data || []);
      }
      setLoadingColetas(false);
    };
    fetchColetas();
  }, [toast]);

  useEffect(() => {
    // Set initial input value if a coleta is already selected
    if (value && coletas.length > 0) {
      const selected = coletas.find(c => c.id === value);
      if (selected) {
        setSearchTerm(selected.numero_coleta?.toString().padStart(6, '0'));
      }
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, coletas]);

  const filteredColetas = useMemo(() => {
    if (!searchTerm) return coletas;
    return coletas.filter(coleta =>
      coleta.numero_coleta?.toString().includes(searchTerm) ||
      coleta.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (coleta.cnpj_cpf && formatCnpjCpf(coleta.cnpj_cpf).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [coletas, searchTerm]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!val) {
      onChange(null); // Clear selected coleta if input is empty
    }
    setShowDropdown(true);
  };

  const handleSelect = (coleta) => {
    onChange(coleta); // Pass the full coleta object
    setSearchTerm(coleta.numero_coleta?.toString().padStart(6, '0'));
    setShowDropdown(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearchTerm('');
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
        // If no coleta is selected and input is not empty, reset to previous selected or empty
        if (!value && searchTerm && !coletas.some(c => c.numero_coleta?.toString().padStart(6, '0') === searchTerm)) {
          setSearchTerm('');
        }
      }
    }, 100);
  };

  const isLoading = parentLoading || loadingColetas;

  return (
    <div className="relative" ref={containerRef}>
      {!hideLabel && <Label htmlFor="coleta-search-select" className="block text-white mb-1 text-sm">{labelText}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="coleta-search-select"
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
          {filteredColetas.length > 0 ? (
            filteredColetas.map(coleta => (
              <div
                key={coleta.id}
                onClick={() => handleSelect(coleta)}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">Nº {coleta.numero_coleta?.toString().padStart(6, '0')} - {coleta.cliente_nome}</div>
                <div className="text-sm text-gray-600">
                  {format(new Date(coleta.data_coleta), 'dd/MM/yyyy', { locale: ptBR })} - {coleta.municipio}/{coleta.estado}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-gray-500">Nenhuma {labelText.toLowerCase()} encontrada.</div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ColetaSearchableSelect;