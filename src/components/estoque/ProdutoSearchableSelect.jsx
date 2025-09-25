import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const ProdutoSearchableSelect = ({
  labelText = "Produto",
  value, // ID do produto selecionado
  onChange, // Callback quando um produto é selecionado
  loading: parentLoading = false,
  disabled = false,
  filterType = null, // 'coletado' ou 'novo' para filtrar produtos
  hideLabel = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const { toast } = useToast();
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Buscar produtos
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        
        let query = supabase
          .from('produtos')
          .select('id, nome, unidade, tipo, codigo')
          .eq('ativo', true)
          .order('nome', { ascending: true });

        if (filterType) {
          query = query.eq('tipo', filterType);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        setProducts(data || []);
      } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        toast({ 
          title: 'Erro ao buscar produtos', 
          description: error.message, 
          variant: 'destructive' 
        });
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [toast, filterType]);

  // Sincronizar searchTerm com o produto selecionado
  useEffect(() => {
    if (value && products.length > 0) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        setSearchTerm(formatProductDisplay(selectedProduct));
      }
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, products]);

  // Filtrar produtos baseado no searchTerm
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    
    const term = searchTerm.toLowerCase();
    return products.filter(product =>
      product.nome.toLowerCase().includes(term) ||
      (product.codigo && product.codigo.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  // Formatador para exibição do produto
  const formatProductDisplay = (product) => {
    return product.codigo ? `${product.nome} (${product.codigo})` : product.nome;
  };

  // Handlers
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Limpar seleção se o input estiver vazio
    if (!newValue.trim()) {
      onChange(null);
    }
    
    setIsDropdownOpen(true);
  };

  const handleSelectProduct = (product) => {
    onChange(product); // Passa o objeto completo do produto
    setSearchTerm(formatProductDisplay(product));
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleClearSelection = () => {
    onChange(null);
    setSearchTerm('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleInputFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleInputBlur = () => {
    // Timeout para permitir clique no dropdown
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setIsDropdownOpen(false);
        
        // Resetar searchTerm se não corresponder a nenhum produto
        if (!value && searchTerm) {
          const matchesProduct = products.some(p => 
            formatProductDisplay(p) === searchTerm
          );
          if (!matchesProduct) {
            setSearchTerm('');
          }
        }
      }
    }, 150);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  // Estados computados
  const isDisabled = disabled || isLoading || parentLoading;
  const showClearButton = searchTerm && !isDisabled;
  const hasProducts = filteredProducts.length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Label */}
      {!hideLabel && (
        <Label htmlFor="product-search" className="block text-white mb-2 text-sm font-medium">
          {labelText}
        </Label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Ícone de busca */}
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
        
        {/* Input */}
        <Input
          ref={inputRef}
          id="product-search"
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={isDisabled ? "Carregando..." : `Buscar ${labelText.toLowerCase()}...`}
          className={`
            pl-10 pr-10 w-full bg-white/10 border-white/20 
            text-white placeholder:text-white/50 rounded-lg
            transition-colors duration-200
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/15'}
            focus:bg-white/15 focus:border-white/40
          `}
          autoComplete="off"
          disabled={isDisabled}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 animate-spin" />
        )}

        {/* Clear Button */}
        {showClearButton && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 hover:bg-white/20 rounded-full"
            onClick={handleClearSelection}
            disabled={isDisabled}
          >
            <X className="h-3 w-3 text-white/70 hover:text-white" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isDropdownOpen && !isDisabled && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-1 bg-gray-900 border border-white/20 rounded-lg shadow-xl max-h-60 overflow-y-auto"
          >
            {hasProducts ? (
              <div className="py-1">
                {filteredProducts.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectProduct(product)}
                    className={`
                      px-3 py-2 cursor-pointer transition-colors duration-150
                      hover:bg-white/10 border-b border-white/5 last:border-b-0
                      ${value === product.id ? 'bg-white/10' : ''}
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-white font-medium text-sm">
                        {product.nome}
                      </span>
                      {product.codigo && (
                        <span className="text-white/60 text-xs bg-white/10 px-1 rounded">
                          {product.codigo}
                        </span>
                      )}
                    </div>
                    <div className="text-white/60 text-xs mt-1">
                      {product.unidade} • {product.tipo}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-center text-white/60 text-sm">
                {searchTerm ? 'Nenhum produto encontrado' : 'Digite para buscar produtos'}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProdutoSearchableSelect;