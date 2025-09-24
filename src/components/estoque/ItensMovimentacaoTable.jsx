import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Loader2 } from 'lucide-react';
import ProdutoSearchableSelect from './ProdutoSearchableSelect';
import { useToast } from '@/components/ui/use-toast';
import { parseCurrency, formatNumber } from '@/lib/utils';
import { IMaskInput } from 'react-imask';
import { supabase } from '@/lib/customSupabaseClient';

const ItensMovimentacaoTable = ({ items, onItemsChange, type, isEditing }) => {
  const { toast } = useToast();
  const [productBalances, setProductBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);

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
    // Garante que sempre haja pelo menos um item vazio se não estiver editando
    if (!isEditing && items.length === 1) {
      onItemsChange([{ id: null, produto_id: null, produto_nome: '', unidade: '', quantidade: '' }]);
    } else {
      const newItems = items.filter((_, i) => i !== index);
      onItemsChange(newItems);
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
  };

  const validateItem = (item) => {
    // Se o item está completamente vazio, não retorna erro
    if (!item.produto_id && (item.quantidade === '' || parseCurrency(item.quantidade) === 0)) {
      return null;
    }
    if (!item.produto_id) return 'Selecione um produto.';
    if (parseCurrency(item.quantidade) <= 0) return 'Quantidade deve ser maior que zero.';
    if (type === 'saida' && !isEditing) { // Only validate stock for new exits
      const currentBalance = productBalances[item.produto_id] || 0;
      if (parseCurrency(item.quantidade) > currentBalance) {
        return `Saldo insuficiente. Disponível: ${formatNumber(currentBalance)} ${item.unidade}.`;
      }
    }
    return null;
  };

  const hasErrors = useMemo(() => {
    // Considera erro apenas se houver itens preenchidos com validação falha
    return items.some(item => (item.produto_id || item.quantidade !== '') && validateItem(item) !== null);
  }, [items, productBalances]);

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
      <div className="rounded-xl border border-white/20 min-h-[200px] max-h-[400px]">
        <div className="overflow-x-auto"> {/* Adicionado overflow-x-auto aqui */}
          <Table className="responsive-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                <TableHead className="text-white w-[40%]">Produto</TableHead>
                <TableHead className="text-white w-[30%] text-right">Quantidade</TableHead>
                <TableHead className="text-white w-[15%] text-center">Unidade</TableHead>
                <TableHead className="text-white w-[15%] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const error = validateItem(item);
                return (
                  <TableRow key={index} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                    <TableCell data-label="Produto" className="py-4 relative z-20">
                    <ProdutoSearchableSelect
                      value={item.produto_id}
                      onChange={(product) => handleProductSelect(index, product)}
                      filterType={type === 'entrada' ? null : null}
                      disabled={isEditing}
                      hideLabel={true}
                    />
                      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    </TableCell>
                    <TableCell data-label="Quantidade" className="text-right py-4">
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
                        placeholder="0,00"
                        className={`w-full bg-white/5 border ${error ? 'border-red-500' : 'border-white/20'} text-white text-right h-10 px-3 py-2 rounded-md text-sm`}
                        disabled={isEditing}
                      />
                    </TableCell>
                    <TableCell data-label="Unidade" className="text-center py-4">
                      {item.unidade || 'N/A'}
                    </TableCell>
                    <TableCell data-label="Ações" className="text-center py-4">
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