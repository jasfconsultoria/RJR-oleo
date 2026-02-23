import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Scale, ArrowDownSquare, ArrowUpSquare } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

const SaldoEstoquePage = () => {
  const [saldoProdutos, setSaldoProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSaldoProdutos = useCallback(async () => {
    setLoading(true);
    // Agora a view v_saldo_produtos já contém o campo produto_codigo
    const { data, error } = await supabase
      .from('v_saldo_produtos')
      .select('*') 
      .order('produto_nome', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao buscar saldo de produtos', description: error.message, variant: 'destructive' });
      setSaldoProdutos([]);
    } else {
      setSaldoProdutos(data || []); 
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchSaldoProdutos();
  }, [fetchSaldoProdutos]);

  const getSaldoColor = (saldo) => {
    if (saldo > 0) return 'text-green-400';
    if (saldo < 0) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <>
      <Helmet><title>Saldo Atual de Estoque - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Scale className="w-8 h-8 text-emerald-400" /> Saldo Atual de Estoque
          </h1>
          <p className="text-emerald-200/80 mt-1">Visualize o saldo atual de cada produto no estoque.</p>
        </motion.div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
          <CardHeader>
            <CardTitle className="text-emerald-300">Resumo por Produto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-xl">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : (
                <Table className="responsive-table">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                      <th className="p-2 text-left text-white">Produto</th>
                      <th className="p-2 text-left text-white">Código</th> {/* Nova coluna */}
                      <th className="p-2 text-left text-white">Tipo</th>
                      <th className="p-2 text-left text-white whitespace-nowrap">Entradas</th> {/* Coluna separada */}
                      <th className="p-2 text-left text-white whitespace-nowrap">Saídas</th> {/* Coluna separada */}
                      <th className="p-2 text-right text-white">Saldo Atual</th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {saldoProdutos.length > 0 ? (
                      saldoProdutos.map(produto => (
                        <TableRow key={produto.produto_id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Produto" className="font-medium whitespace-nowrap">{produto.produto_nome}</TableCell>
                          <TableCell data-label="Código" className="font-mono whitespace-nowrap">{produto.produto_codigo || 'N/A'}</TableCell> {/* Nova célula */}
                          <TableCell data-label="Tipo" className="capitalize whitespace-nowrap">{produto.produto_tipo}</TableCell>
                          <TableCell data-label="Entradas" className="text-left whitespace-nowrap"> {/* Conteúdo em uma linha */}
                            <span className="flex items-center gap-1 text-green-400">
                              <ArrowDownSquare className="h-4 w-4" /> {formatNumber(produto.total_entradas)} {produto.unidade}
                            </span>
                          </TableCell>
                          <TableCell data-label="Saídas" className="text-left whitespace-nowrap"> {/* Conteúdo em uma linha */}
                            <span className="flex items-center gap-1 text-red-400">
                              <ArrowUpSquare className="h-4 w-4" /> {formatNumber(produto.total_saidas)} {produto.unidade}
                            </span>
                          </TableCell>
                          <TableCell data-label="Saldo Atual" className={`text-right font-bold whitespace-nowrap ${getSaldoColor(produto.saldo_atual)}`}>
                            {formatNumber(produto.saldo_atual)} {produto.unidade}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan="6" className="text-center text-gray-400 py-10">Nenhum produto encontrado ou sem movimentações.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default SaldoEstoquePage;