import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const ColetaSearchableSelect = ({ value, onChange, disabled = false, labelText = "Nº Coleta", required = false }) => {
  const [coletas, setColetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchColetas = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('coletas')
        .select('id, numero_coleta')
        .order('numero_coleta', { ascending: false });

      if (error) {
        toast({ title: 'Erro ao buscar coletas', description: error.message, variant: 'destructive' });
        setColetas([]);
      } else {
        setColetas(data || []);
      }
      setLoading(false);
    };

    fetchColetas();
  }, [toast]);

  useEffect(() => {
    if (value) {
        setInputValue(value.toString().padStart(6, '0'));
    } else {
        setInputValue('');
    }
  }, [value]);

  const filteredColetas = useMemo(() => {
    if (!inputValue) {
      return coletas;
    }
    return coletas.filter(coleta =>
      coleta.numero_coleta.toString().padStart(6, '0').includes(inputValue)
    );
  }, [inputValue, coletas]);

  const handleSelect = (coleta) => {
    onChange(coleta.numero_coleta);
    setInputValue(coleta.numero_coleta.toString().padStart(6, '0'));
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
        if (value) {
          setInputValue(value.toString().padStart(6, '0'));
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [value]);

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="coleta-searchable-select" className="block text-white mb-1 text-sm">{labelText} {required && '*'}</Label>
      <div className="relative">
        <Input
          id="coleta-searchable-select"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          placeholder={loading ? "Carregando..." : "Digite para buscar..."}
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
          {filteredColetas.length > 0 ? filteredColetas.map((coleta) => (
            <div
              key={coleta.id}
              onClick={() => handleSelect(coleta)}
              className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{coleta.numero_coleta.toString().padStart(6, '0')}</div>
            </div>
          )) : (
            <div className="p-3 text-center text-gray-500">
              {loading ? "Carregando..." : "Nenhuma coleta encontrada."}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default ColetaSearchableSelect;