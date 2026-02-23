import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Loader2 } from 'lucide-react';
import ProdutoSearchableSelect from '@/components/produtos/ProdutoSearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { parseCurrency, formatNumber } from '@/lib/utils';
import { IMaskInput } from 'react-imask';
import { supabase } from '@/lib/customSupabaseClient';

const ItensMovimentacaoTable = ({ items, onItemsChange, type, isEditing }) => {
  const { toast } = useToast();
  const [productBalances, setProductBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [touchedItems, setTouchedItems] = useState({});
  const [validatedItems, setValidatedItems] = useState({}); // Novo estado para itens validados

  const fetchProductBalances = useCallback(async () => {
    setLoadingBalances(true);
    const { data, error } = await supabase.from('v_saldo_produtos').select('*');
    if (error) {
      toast({ title: 'Erro ao buscar saldos de produtos', description: error.message, variant: 'destructive' });
    } else {
      const balancesMap = data.reduce((acc, p) => {
        acc[p.produto_id] = p.saldo_atual;
        return acc;
      }, {});
      setProductBalances(balancesMap);
    }
    setLoadingBalances(false);
  }, [toast]);

  useEffect(() => {
    if (type === 'saida') {
      fetchProductBalances();
    }
  }, [type, fetchProductBalances]);

  const handleAddItem = () => {
    onItemsChange([...items, { id: null, produto_id: null, produto_nome: '', unidade: '', quantidade: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (!isEditing && items.length === 1) {
      onItemsChange([{ id: null, produto_id: null, produto_nome: '', unidade: '', quantidade: '' }]);
    } else {
      const newItems = items.filter((_, i) => i !== index);
      onItemsChange(newItems);
      
      // Limpar estados do item removido
      setTouchedItems(prev => {
        const newTouched = { ...prev };
        delete newTouched[index];
        return newTouched;
      });
      setValidatedItems(prev => {
        const newValidated = { ...prev };
        delete newValidated[index];
        return newValidated;
      });
    }
  };

  const handleProductSelect = (index, product) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      produto_id: product ? product.id : null,
      produto_nome: product ? product.nome : '',
      unidade: product ? product.unidade : '',
      tipo: product ? product.tipo : '',
    };
    onItemsChange(newItems);
  };

  const handleQuantityChange = (index, value) => {
    const newItems = [...items];
    newItems[index].quantidade = value;
    onItemsChange(newItems);
    
    // Marcar como validado apenas se o usuário realmente digitou algo
    if (value !== '' && value !== '0,00') {
      setValidatedItems(prev => ({ ...prev, [index]: true }));
    }
  };

  const handleQuantityFocus = (index) => {
    // Só marcar como tocado, não como validado ainda
    setTouchedItems(prev => ({ ...prev, [index]: true }));
  };

  const handleQuantityBlur = (index, value) => {
    // Marcar como validado apenas quando o usuário sair do campo e tiver digitado algo
    if (value && value !== '' && value !== '0,00' && parseCurrency(value) > 0) {
      setValidatedItems(prev => ({ ...prev, [index]: true }));
    }
  };

  const validateItem = (item, index) => {
    // Não mostrar erro se o item não foi validado ainda
    if (!validatedItems[index]) {
      return null;
    }

    // Se o item está completamente vazio, não retorna erro
    if (!item.produto_id && (item.quantidade === '' || parseCurrency(item.quantidade) === 0)) {
      return null;
    }
    
    if (!item.produto_id) return 'Selecione um produto.';
    
    const quantidade = parseCurrency(item.quantidade);
    if (quantidade <= 0) return 'Quantidade deve ser maior que zero.';
    
    if (type === 'saida' && !isEditing) {
      const currentBalance = productBalances[item.produto_id] || 0;
      if (quantidade > currentBalance) {
        return `Saldo insuficiente. Disponível: ${formatNumber(currentBalance)} ${item.unidade}.`;
      }
    }
    
    return null;
  };

  const hasErrors = useMemo(() => {
    return items.some((item, index) => validatedItems[index] && validateItem(item, index) !== null);
  }, [items, validatedItems, productBalances]);

  useEffect(() => {
    if (hasErrors) {
      toast({
        title: 'Erro nos itens da movimentação',
        description: 'Verifique os produtos e quantidades. Saldo insuficiente para saídas.',
        variant: 'destructive',
      });
    }
  }, [hasErrors, toast]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Itens da Movimentação *</h3>
      
      <div className="rounded-xl border border-white/20 min-h-[200px] max-h-[400px] overflow-visible">
        <div className="relative w-full overflow-visible">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                <TableHead className="text-white w-[50%]">Produto</TableHead>
                <TableHead className="text-white w-[20%] text-right">Quantidade</TableHead>
                <TableHead className="text-white w-[15%] text-center">Unidade</TableHead>
                <TableHead className="text-white w-[15%] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {items.map((item, index) => {
                const error = validateItem(item, index);
                const isEmptyItem = !item.produto_id && (!item.quantidade || item.quantidade === '' || item.quantidade === '0,00');
                
                return (
                  <TableRow key={index} className="border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                    <TableCell className="py-4 overflow-visible" style={{ position: 'relative', zIndex: items.length - index + 10 }}>
                      <div style={{ position: 'static' }}>
                        <ProdutoSearchableSelect
                          value={item.produto_id}
                          onChange={(product) => handleProductSelect(index, product)}
                          filterType={type === 'entrada' ? null : null}
                          disabled={isEditing}
                          hideLabel={true}
                        />
                      </div>
                      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </TableCell>
                    
                    <TableCell className="text-right py-4">
                      <IMaskInput
                        mask="num"
                        blocks={{
                          num: {
                            mask: Number,
                            thousandsSeparator: '.',
                            radix: ',',
                            mapToRadix: ['.'],
                            scale: 2,
                            padFractionalZeros: true,
                            normalizeZeros: true,
                            signed: false,
                          },
                        }}
                        value={item.quantidade}
                        onAccept={(value) => handleQuantityChange(index, value)}
                        onFocus={() => handleQuantityFocus(index)}
                        onBlur={(e) => handleQuantityBlur(index, e.target.value)}
                        placeholder="0,00"
                        className={`w-full bg-white/5 border ${
                          error ? 'border-red-500' : 
                          validatedItems[index] ? 'border-green-500/50' : 'border-white/20'
                        } text-white text-right h-10 px-3 py-2 rounded-md text-sm`}
                      />
                    </TableCell>
                    
                    <TableCell className="text-center py-4">
                      {item.unidade || 'N/A'}
                    </TableCell>
                    
                    <TableCell className="text-center py-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-400 hover:text-red-300"
                        disabled={isEditing}
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      
      <Button type="button" onClick={handleAddItem} variant="outline" className="w-full" disabled={isEditing}>
        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
      </Button>
    </div>
  );
};

export default ItensMovimentacaoTable;