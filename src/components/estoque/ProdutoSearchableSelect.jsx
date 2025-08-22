import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, X, Search } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';

const ProdutoSearchableSelect = ({
  labelText = "Produto",
  value, // selected product ID
  onChange, // callback for when a product is selected (id, name, unit, type)
  loading: parentLoading = false,
  disabled = false,
  filterType = null, // 'coletado' or 'novo' to filter products
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const { toast } = useToast();
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      let query = supabase
        .from('produtos')
        .select('id, nome, unidade, tipo')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (filterType) {
        query = query.eq('tipo', filterType);
      }

      const { data, error } = await query;

      if (error) {
        toast({ title: 'Erro ao buscar produtos', description: error.message, variant: 'destructive' });
        setProducts([]);
      } else {
        setProducts(data || []);
      }
      setLoadingProducts(false);
    };
    fetchProducts();
  }, [toast, filterType]);

  useEffect(() => {
    // Set initial input value if a product is already selected
    if (value && products.length > 0) {
      const selected = products.find(p => p.id === value);
      if (selected) {
        setSearchTerm(selected.nome);
      }
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(product =>
      product.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (!val) {
      onChange(null); // Clear selected product if input is empty
    }
    setShowDropdown(true);
  };

  const handleSelect = (product) => {
    onChange(product); // Pass the full product object
    setSearchTerm(product.nome);
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
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setShowDropdown(false);
        if (!value && searchTerm && !products.some(p => p.nome === searchTerm)) {
          setSearchTerm('');
        }
      }
    }, 100);
  };

  const isLoading = parentLoading || loadingProducts;

  return (
    <div className="relative" ref={containerRef}>
      <Label htmlFor="product-search-select" className="block text-white mb-1 text-sm">{labelText}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
        <Input
          id="product-search-select"
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
          {filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => handleSelect(product)}
                className="p-3 hover:bg-emerald-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-gray-900">{product.nome}</div>
                <div className="text-sm text-gray-600">{product.unidade} ({product.tipo})</div>
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

export default ProdutoSearchableSelect;