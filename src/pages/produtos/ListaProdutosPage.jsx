import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, PlusCircle, Edit, Trash2, Search, Package, CheckCircle, XCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pagination } from '@/components/ui/pagination';
import { logAction } from '@/lib/logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RESTRICTED_PRODUCTS = [
  "Óleo de fritura",
  "Óleo de soja novo (900ml)"
];

const ListaProdutosPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'coletado', 'novo', 'all'
  const [activeFilter, setActiveFilter] = useState('all'); // 'true', 'false', 'all'
  const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'asc' });
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [empresa, setEmpresa] = useState(null);

  const pageSize = useMemo(() => empresa?.items_per_page || 25, [empresa]);

  useEffect(() => {
    const fetchEmpresa = async () => {
      const { data, error } = await supabase.from('empresa').select('items_per_page').single();
      if (error) toast({ title: 'Erro ao buscar configurações da empresa', variant: 'destructive' });
      else setEmpresa(data || { items_per_page: 25 });
    };
    fetchEmpresa();
  }, [toast]);

  const fetchProdutos = useCallback(async () => {
    if (!empresa) return;
    setLoading(true);
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('produtos')
      .select('*', { count: 'exact' });

    if (debouncedSearchTerm) {
      query = query.or(`nome.ilike.%${debouncedSearchTerm}%,codigo.ilike.%${debouncedSearchTerm}%`); // Incluir busca por código
    }
    if (typeFilter !== 'all') {
      query = query.eq('tipo', typeFilter);
    }
    if (activeFilter !== 'all') {
      query = query.eq('ativo', activeFilter === 'true');
    }

    query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast({ title: 'Erro ao buscar produtos', description: error.message, variant: 'destructive' });
      setProdutos([]);
    } else {
      setProdutos(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [toast, currentPage, pageSize, debouncedSearchTerm, typeFilter, activeFilter, sortConfig, empresa]);

  useEffect(() => {
    if (empresa) {
      fetchProdutos();
    }
  }, [fetchProdutos, empresa]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, typeFilter, activeFilter, pageSize]);

  const handleDelete = async (id, nome) => {
    if (RESTRICTED_PRODUCTS.includes(nome)) {
      toast({ title: 'Ação não permitida', description: 'Este produto não pode ser excluído.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao deletar produto', description: error.message, variant: 'destructive' });
    } else {
      await logAction('delete_product', { product_id: id, product_name: nome });
      toast({ title: 'Produto deletado com sucesso' });
      fetchProdutos();
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Helmet><title>Lista de Produtos - RJR Óleo</title></Helmet>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                <Package className="w-8 h-8 text-emerald-400" /> Lista de Produtos
            </h1>
            <p className="text-emerald-200/80 mt-1">Gerencie os produtos disponíveis no estoque.</p>
          </div>
          <Button onClick={() => navigate('/app/estoque/produtos/novo')} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto rounded-xl">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Produto
          </Button>
        </motion.div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="searchTerm"
                  type="search"
                  placeholder="Nome ou código do produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="typeFilter" className="block text-white mb-1 text-sm">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                  <SelectValue placeholder="Todos os Tipos" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="coletado">Coletado</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="activeFilter" className="block text-white mb-1 text-sm">Status</Label>
              <Select value={activeFilter} onValueChange={setActiveFilter}>
                <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/10 backdrop-blur-sm rounded-xl">
          <div className="overflow-x-auto rounded-xl">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-white/20 text-xs">
                    <th onClick={() => requestSort('codigo')} className="cursor-pointer p-2 text-left text-white">
                      <div className="flex items-center">Código {getSortIcon('codigo')}</div>
                    </th>
                    <th onClick={() => requestSort('nome')} className="cursor-pointer p-2 text-left text-white">
                      <div className="flex items-center">Nome {getSortIcon('nome')}</div>
                    </th>
                    <th onClick={() => requestSort('unidade')} className="cursor-pointer p-2 text-left text-white">
                      <div className="flex items-center">Unidade {getSortIcon('unidade')}</div>
                    </th>
                    <th onClick={() => requestSort('tipo')} className="cursor-pointer p-2 text-left text-white">
                      <div className="flex items-center">Tipo {getSortIcon('tipo')}</div>
                    </th>
                    <th onClick={() => requestSort('ativo')} className="cursor-pointer p-2 text-center text-white">
                      <div className="flex items-center justify-center">Ativo {getSortIcon('ativo')}</div>
                    </th>
                    <th className="p-2 text-right text-white">Ações</th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtos.length > 0 ? (
                    produtos.map(produto => {
                      const isRestricted = RESTRICTED_PRODUCTS.includes(produto.nome);
                      return (
                        <TableRow key={produto.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/5 text-sm">
                          <TableCell data-label="Código" className="font-mono">{produto.codigo}</TableCell>
                          <TableCell data-label="Nome" className="font-medium">{produto.nome}</TableCell>
                          <TableCell data-label="Unidade" className="capitalize">{produto.unidade}</TableCell>
                          <TableCell data-label="Tipo" className="capitalize">{produto.tipo}</TableCell>
                          <TableCell data-label="Ativo" className="text-center">
                            {produto.ativo ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-red-500 mx-auto" />}
                          </TableCell>
                          <TableCell className="text-right actions-cell">
                             <div className="flex justify-end items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-yellow-400 hover:text-yellow-300 rounded-xl" 
                                onClick={() => navigate(`/app/estoque/produtos/editar/${produto.id}`)}
                                disabled={isRestricted}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-red-400 hover:text-red-300 rounded-xl"
                                    disabled={isRestricted}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-emerald-900 border-emerald-700 text-white rounded-xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-emerald-300">Essa ação não pode ser desfeita. Isso deletará permanentemente o produto {produto.nome}.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="border-gray-500 text-gray-300 rounded-xl">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(produto.id, produto.nome)} className="bg-red-500 hover:bg-red-600 rounded-xl">Deletar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                             </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan="6" className="text-center text-gray-400 py-10">Nenhum produto encontrado.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            </div>
        </motion.div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          pageSize={pageSize}
          totalCount={totalCount}
        />
      </div>
    </>
  );
};

export default ListaProdutosPage;