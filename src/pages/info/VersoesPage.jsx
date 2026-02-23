import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { GitBranch, ArrowLeft, Loader2, FileSearch, Hash } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { Pagination } from '@/components/ui/pagination';

const VersoesPage = () => {
  const [versoes, setVersoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(10); // Default, will be updated by empresa settings
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchEmpresaData = async () => {
      const { data: empresaData, error: empresaError } = await supabase
        .from('empresa')
        .select('timezone, items_per_page')
        .single();
      
      if (empresaData) {
        if (empresaData.timezone) {
          setEmpresaTimezone(empresaData.timezone);
        }
        if (empresaData.items_per_page) {
          setPageSize(empresaData.items_per_page);
        }
      }
    };
    fetchEmpresaData();
  }, []);

  const fetchVersoes = useCallback(async () => {
    setLoading(true);

    // A ordenação por versão semântica (ex: 1.10.0 vs 1.2.0) é complexa no SQL.
    // A melhor abordagem é buscar todos, ordenar no cliente e depois paginar.
    // Se o número de versões se tornar muito grande (+1000), uma função RPC seria necessária.
    const { data, error } = await supabase
      .from('versoes')
      .select('*', { count: 'exact' });

    if (error) {
      toast({ title: 'Erro ao buscar versões', description: error.message, variant: 'destructive' });
      setVersoes([]);
      setTotalCount(0);
    } else {
      setVersoes(data || []);
      setTotalCount(data?.length || 0);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchVersoes();
  }, [fetchVersoes]);

  const paginatedAndSortedVersoes = useMemo(() => {
    const compareVersions = (v1, v2) => {
      const parts1 = v1.split('.').map(Number);
      const parts2 = v2.split('.').map(Number);
      const len = Math.max(parts1.length, parts2.length);

      for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return -1;
        if (p1 < p2) return 1;
      }
      return 0;
    };
    
    const sorted = [...versoes].sort((a, b) => compareVersions(a.versao, b.versao));
    
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize;
    
    return sorted.slice(from, to);
  }, [versoes, currentPage, pageSize]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const formatarData = (date) => {
    if (!date) return '-';
    try {
      return formatInTimeZone(new Date(date), empresaTimezone, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (e) {
      console.error("Failed to format date:", e);
      return "Data inválida";
    }
  };

  return (
    <>
      <Helmet>
        <title>Histórico de Versões - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto p-4 md:p-8"
      >
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-emerald-400" />
              Histórico de Versões do Sistema
            </CardTitle>
            <CardDescription className="text-emerald-200/80">
              Acompanhe todas as atualizações e melhorias implementadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/20 hover:bg-white/10">
                      <TableHead className="text-emerald-300 w-[100px]">Versão</TableHead>
                      <TableHead className="text-emerald-300 w-[200px]">Data de Implantação</TableHead>
                      <TableHead className="text-emerald-300">Hash</TableHead>
                      <TableHead className="text-emerald-300 text-right w-[150px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAndSortedVersoes.map((versao) => (
                      <TableRow key={versao.id} className="border-b-0 md:border-b border-white/10 text-white/90 hover:bg-white/15">
                        <TableCell className="font-medium">{versao.versao}</TableCell>
                        <TableCell>{formatarData(versao.data_implantacao)}</TableCell>
                        <TableCell className="font-mono text-sm text-gray-400">
                          {versao.hash || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-emerald-300 hover:text-white hover:bg-emerald-700">
                                <FileSearch className="w-4 h-4 mr-2" />
                                Ver Detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-gray-800 text-white border-gray-700 max-w-lg max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle className="text-emerald-400">Detalhes da Versão {versao.versao}</DialogTitle>
                                <DialogDescription className="text-gray-400">
                                   Implantada em {formatarData(versao.data_implantacao)}
                                </DialogDescription>
                              </DialogHeader>
                              {versao.hash && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                                  <Hash className="w-4 h-4" />
                                  <span className="font-mono break-all">{versao.hash}</span>
                                </div>
                              )}
                              <div className="prose prose-invert max-w-none text-gray-300 py-4 whitespace-pre-wrap">
                                {versao.descricao}
                              </div>
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button className="bg-emerald-600 hover:bg-emerald-700">Fechar</Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && paginatedAndSortedVersoes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan="4" className="h-24 text-center text-white/70">
                          Nenhuma versão encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
             <Pagination 
                className="mt-6"
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                pageSize={pageSize}
                totalCount={totalCount}
              />
             <div className="flex justify-start items-center pt-6 mt-4">
                <Button
                  type="button"
                  onClick={() => navigate(-1)}
                  variant="outline"
                  className="w-auto rounded-xl"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Voltar
                </Button>
              </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
};

export default VersoesPage;