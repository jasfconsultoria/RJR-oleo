import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const CentroCustoSearchableSelect = ({
  labelText = "Centro de Custo",
  value, // selected cost center name or 'all' for "Todos"
  onChange, // callback for when a cost center is selected (name)
  loading: parentLoading = false,
  disabled = false,
  // New props for controlled search term
  searchTerm: controlledSearchTerm, // The search text from parent
  onSearchTermChange, // Callback to update parent's search text
  version = 0, // Version number to force refresh when changed
  allowAll = false, // If true, allows 'all' as a special value
  required = false, // If true, shows a red asterisk
}) => {
  // Internal state for dropdown visibility and cost center list
  const [costCenters, setCostCenters] = useState([]);
  const [loadingCostCenters, setLoadingCostCenters] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Use internal state for the input value if not controlled, otherwise use controlledSearchTerm
  const [internalSearchTerm, setInternalSearchTerm] = useState(controlledSearchTerm || '');

  // Sync internalSearchTerm with controlledSearchTerm
  useEffect(() => {
    setInternalSearchTerm(controlledSearchTerm || '');
  }, [controlledSearchTerm]);

  useEffect(() => {
    const fetchCostCenters = async () => {
      setLoadingCostCenters(true);
      const { data, error } = await supabase
        .from('centro_custos')
        .select('id, nome, codigo')
        .order('nome', { ascending: true });

      if (error) {
        toast({ title: 'Erro ao buscar centros de custo', description: error.message, variant: 'destructive' });
        setCostCenters([]);
      } else {
        setCostCenters(data || []);
      }
      setLoadingCostCenters(false);
    };
    fetchCostCenters();
  }, [toast, version]);

  useEffect(() => {
    // Set initial input value if a cost center is already selected
    if (value === 'all' && allowAll) {
      setInternalSearchTerm('Todos os Centros de Custo');
      onSearchTermChange && onSearchTermChange('Todos os Centros de Custo');
    } else if (value && value.trim() !== '' && value !== 'all') {
      if (costCenters.length > 0) {
        const selected = costCenters.find(c => c.nome === value);
        if (selected) {
          setInternalSearchTerm(selected.nome);
          onSearchTermChange && onSearchTermChange(selected.nome);
        } else {
          // Se o valor não foi encontrado, limpar
          setInternalSearchTerm('');
          onSearchTermChange && onSearchTermChange('');
        }
      }
    } else {
      // Se não há valor ou está vazio, garantir que está limpo para mostrar placeholder
      setInternalSearchTerm('');
      onSearchTermChange && onSearchTermChange('');
    }
  }, [value, costCenters, controlledSearchTerm, onSearchTermChange, allowAll]);

  const filteredCostCenters = useMemo(() => {
    if (!internalSearchTerm) return costCenters;
    return costCenters.filter(center =>
      center.nome.toLowerCase().includes(internalSearchTerm.toLowerCase()) ||
      (center.codigo && center.codigo.toLowerCase().includes(internalSearchTerm.toLowerCase()))
    );
  }, [costCenters, internalSearchTerm]);

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

  const handleSelect = (center) => {
    if (center === 'all') {
      onChange('all'); // Passa 'all' para "Todos os Centros de Custo"
      setInternalSearchTerm('Todos os Centros de Custo');
      onSearchTermChange && onSearchTermChange('Todos os Centros de Custo');
    } else {
      onChange(center.nome); // Passa o nome do centro de custo
      setInternalSearchTerm(center.nome);
      onSearchTermChange && onSearchTermChange(center.nome);
    }
    setShowDropdown(false);

    // ✅ CORREÇÃO: Devolver o foco para o input após a seleção
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
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
        if (!value && internalSearchTerm && !costCenters.some(c => c.nome === internalSearchTerm)) {
          setInternalSearchTerm('');
          onSearchTermChange && onSearchTermChange('');
        }
      }
    }, 100);
  };

  const isLoading = parentLoading || loadingCostCenters;

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="cost-center-search-select" className="block text-white mb-1 text-sm">
        {labelText} {required && <span className="text-red-500">*</span>}
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="cost-center-search-select"
          ref={inputRef} // ✅ Adicionado Ref
          type="text"
          value={internalSearchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isLoading ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className="pl-10 w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl pr-10 h-9 text-xs"
          autoComplete="off"
          disabled={disabled || isLoading}
        />
        {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />}
        {!isLoading && internalSearchTerm && (
          <Button
            variant="ghost"
            size="icon"
            tabIndex={-1} // ✅ CORREÇÃO: Não interromper o fluxo de TAB entre inputs
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
          {allowAll && (
            <div
              onMouseDown={(e) => {
                e.preventDefault(); // ✅ CORREÇÃO: Evitar que o input perca o foco no clique
                handleSelect('all');
              }}
              className={`p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 ${value === 'all' ? 'bg-emerald-50' : ''
                }`}
            >
              <div className="font-medium text-gray-900">
                Todos os Centros de Custo
              </div>
            </div>
          )}
          {filteredCostCenters.length > 0 ? (
            filteredCostCenters.map(center => (
              <div
                key={center.id}
                onMouseDown={(e) => {
                  e.preventDefault(); // ✅ CORREÇÃO: Evitar que o input perca o foco no clique
                  handleSelect(center);
                }}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">
                  {center.nome}
                </div>
                {center.codigo && (
                  <div className="text-sm text-gray-600">
                    Código: {center.codigo}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-gray-500">Nenhum centro de custo encontrado.</div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default CentroCustoSearchableSelect;

