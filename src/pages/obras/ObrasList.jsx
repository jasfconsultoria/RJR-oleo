"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Search, PlusCircle, Edit, Trash2, Building, ArrowUp, ArrowDown, Filter, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logAction } from '@/lib/log';
import { normalizeString } from '@/lib/utils';
import Pagination from '@/components/ui/pagination';
import { AdminValidationDialog } from '@/components/empresa/AdminValidationDialog';

const ObrasList = () => {
    const { user: currentUser, activeCompany } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [obras, setObras] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState('obra');
    const [sortDirection, setSortDirection] = useState('asc');
    const [showFilters, setShowFilters] = useState(false);

    // Novos estados para validação de exclusão
    const [isValidationOpen, setIsValidationOpen] = useState(false);
    const [obraToDelete, setObraToDelete] = useState(null);
    const [isCheckingDependencies, setIsCheckingDependencies] = useState(false);

    // Estados para duplicação
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [obraToDuplicate, setObraToDuplicate] = useState(null);
    const [duplicating, setDuplicating] = useState(false);

    const ITEMS_PER_PAGE = 10;

    const formatCurrency = (value) => {
        if (value === null || value === undefined) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const getStatusText = (status) => {
        switch (status) {
            case 1: return 'Em andamento';
            case 2: return 'Concluída';
            case 3: return 'Paralisada';
            default: return 'Desconhecido';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 1: return 'text-blue-600 bg-blue-50';
            case 2: return 'text-green-600 bg-green-50';
            case 3: return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const fetchObras = useCallback(async (searchTermParam = '') => {
        console.log("ObrasList: Iniciando busca de obras...", {
            activeCompany: activeCompany?.cnpj,
            searchTerm: searchTermParam,
            env: supabase.supabaseUrl
        });
        setLoading(true);
        try {
            if (!activeCompany?.cnpj) {
                console.warn("ObrasList: Empresa sem CNPJ, abortando busca.");
                setObras([]);
                setLoading(false);
                return;
            }

            const cnpjLimpo = activeCompany.cnpj.replace(/\D/g, '');
            const searchTermTrimmed = searchTermParam.trim();

            console.log(`ObrasList: Consultando view 'obras_com_cliente' para empresa ${cnpjLimpo}...`);

            let query = supabase
                .from('obras_com_cliente')
                .select('*')
                .eq('empresa', cnpjLimpo);

            if (searchTermTrimmed) {
                const normalizedSearchTerm = normalizeString(searchTermTrimmed);
                query = query.or(`obra.ilike.%${normalizedSearchTerm}%,contratante_nome.ilike.%${normalizedSearchTerm}%,responsavel.ilike.%${normalizedSearchTerm}%`);
            }

            const fetchPromise = query.order('data_cad', { ascending: false });

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_OBRAS_LIST')), 15000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) {
                console.error("ObrasList: Erro do Supabase:", error);
                throw error;
            }

            console.log(`ObrasList: ${data?.length || 0} obras encontradas.`);

            // ✅ Garantir que não haja obras duplicadas (por possíveis duplicidades na view/join)
            const uniqueObras = (data || []).reduce((acc, obra) => {
                if (!acc.map.has(obra.id)) {
                    acc.map.set(obra.id, true);
                    acc.list.push(obra);
                }
                return acc;
            }, { map: new Map(), list: [] }).list;

            setObras(uniqueObras);
        } catch (error) {
            console.error("ObrasList: Exceção na busca:", error);
            toast({
                variant: "destructive",
                title: "Erro ao carregar obras",
                description: error.message === 'TIMEOUT_OBRAS_LIST'
                    ? "A listagem demorou muito a responder. Verifique sua conexão."
                    : error.message,
            });
        } finally {
            setLoading(false);
            console.log("ObrasList: Carregamento finalizado.");
        }
    }, [toast, activeCompany]);

    useEffect(() => {
        fetchObras(searchTerm);
    }, [activeCompany?.cnpj]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchObras(searchTerm);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [fetchObras, searchTerm]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const sortedAndFilteredObras = useMemo(() => {
        return [...obras].sort((a, b) => {
            let aValue, bValue;

            switch (sortColumn) {
                case 'status':
                    aValue = a.status || 0;
                    bValue = b.status || 0;
                    break;
                case 'inicio':
                case 'fim':
                case 'data_cad':
                    aValue = a[sortColumn] ? new Date(a[sortColumn]).getTime() : 0;
                    bValue = b[sortColumn] ? new Date(b[sortColumn]).getTime() : 0;
                    break;
                case 'valor_inicial':
                    aValue = a[sortColumn] || 0;
                    bValue = b[sortColumn] || 0;
                    break;
                case 'contratante_nome':
                    aValue = normalizeString(a.contratante_nome || '');
                    bValue = normalizeString(b.contratante_nome || '');
                    break;
                default:
                    aValue = normalizeString(a[sortColumn] || '');
                    bValue = normalizeString(b[sortColumn] || '');
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [obras, sortColumn, sortDirection]);

    const paginatedObras = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedAndFilteredObras.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedAndFilteredObras, currentPage]);

    const totalPages = Math.ceil(sortedAndFilteredObras.length / ITEMS_PER_PAGE);

    const checkObraDependencies = async (obraId) => {
        try {
            // 1. Verificar Visitas
            const { count: visitsCount, error: visitsError } = await supabase
                .from('obras_visitas')
                .select('*', { count: 'exact', head: true })
                .eq('obra_id', obraId);

            if (visitsError) throw visitsError;
            if (visitsCount > 0) {
                return { hasDependencies: true, reason: `Esta obra possui ${visitsCount} visita(s) vinculada(s). Exclua as visitas antes de remover a obra.` };
            }

            // 2. Verificar Financeiro
            const obra = obras.find(o => o.id === obraId);
            const obraNome = obra?.obra || '';
            const obraCodigo = obra?.codigo || '';

            const { count: financeCount, error: financeError } = await supabase
                .from('credito_debito')
                .select('*', { count: 'exact', head: true })
                .or(`obra.eq.${obraId},obra.ilike.%${obraNome}%,observacao.ilike.%${obraNome}%,observacao.ilike.%Código: ${obraCodigo}%`);

            if (financeError) throw financeError;
            if (financeCount > 0) {
                return { hasDependencies: true, reason: `Esta obra possui ${financeCount} lançamento(s) financeiro(s) vinculado(s).` };
            }

            return { hasDependencies: false };
        } catch (error) {
            console.error("Erro ao verificar dependências:", error);
            throw error;
        }
    };

    const confirmDelete = async (validatorData) => {
        if (!obraToDelete) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('obras')
                .delete()
                .eq('id', obraToDelete.id);

            if (error) throw error;

            toast({ title: 'Obra excluída!', description: `"${obraToDelete.nome}" foi removida com sucesso.` });

            // Gravar Log com dados do validador
            if (currentUser) {
                const logMsg = `Obra "${obraToDelete.nome}" (ID: ${obraToDelete.id}) excluída. Validado por: ${validatorData.validatorEmail} (${validatorData.validatorRole})`;
                await logAction(currentUser.id, 'obra_delete', logMsg, null, obraToDelete.id);
            }

            setObraToDelete(null);
            fetchObras();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao excluir', description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteObra = async (obraId, obraNome) => {
        setIsCheckingDependencies(true);
        try {
            const check = await checkObraDependencies(obraId);
            if (check.hasDependencies) {
                toast({
                    variant: 'destructive',
                    title: 'Não é possível excluir',
                    description: check.reason
                });
                return;
            }

            setObraToDelete({ id: obraId, nome: obraNome });
            setIsValidationOpen(true);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao verificar dependências', description: error.message });
        } finally {
            setIsCheckingDependencies(false);
        }
    };

    const handleDuplicateClick = (obra) => {
        setObraToDuplicate(obra);
        setShowDuplicateDialog(true);
    };

    const confirmDuplicate = async () => {
        if (!obraToDuplicate || !activeCompany?.cnpj) return;
        setDuplicating(true);
        try {
            // Busca dados originais completos da tabela (pois a view pode não ter tudo igual à tabela)
            const { data: originalData, error: fetchError } = await supabase
                .from('obras')
                .select('*')
                .eq('id', obraToDuplicate.id)
                .single();

            if (fetchError) throw fetchError;

            // Gerar próximo código
            const cleanCnpj = activeCompany.cnpj.replace(/\D/g, '');
            const { data: codesData } = await supabase.from('obras').select('codigo').eq('empresa', cleanCnpj);
            let maxCode = 0;
            if (codesData) {
                codesData.forEach(item => {
                    if (item.codigo) {
                        const numericPart = String(item.codigo).replace(/\D/g, '');
                        if (numericPart) {
                            const numValue = parseInt(numericPart, 10);
                            if (!isNaN(numValue) && numValue > maxCode) maxCode = numValue;
                        }
                    }
                });
            }
            const nextCode = (maxCode + 1).toString().padStart(5, '0');

            // Remove campos controlados
            const { id, created_at, updated_at, ...dataToCopy } = originalData;

            dataToCopy.obra = `${dataToCopy.obra} (Cópia)`;
            dataToCopy.codigo = nextCode;

            const { error: insertError } = await supabase.from('obras').insert([dataToCopy]);

            if (insertError) throw insertError;

            toast({ title: 'Obra Duplicada', description: `A obra "${obraToDuplicate.obra}" foi duplicada com sucesso.` });

            if (currentUser) {
                await logAction(currentUser.id, 'obra_duplicate', `Obra duplicada a partir de ${obraToDuplicate.id}`, activeCompany.id);
            }

            setShowDuplicateDialog(false);
            setObraToDuplicate(null);
            fetchObras(searchTerm);

        } catch (error) {
            console.error('Erro ao duplicar obra:', error);
            toast({ variant: 'destructive', title: 'Erro ao duplicar', description: error.message });
        } finally {
            setDuplicating(false);
        }
    };

    const renderSortIcon = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
        }
        return null;
    };

    // Componente de Card para Mobile
    const ObraCard = ({ obra }) => (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">#{obra.codigo}</span>
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-blue-400 truncate max-w-[200px]" title={obra.obra}>
                        {obra.obra}
                    </h3>
                </div>
                <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(obra.status)}`}>
                        {getStatusText(obra.status)}
                    </span>
                </div>
            </div>

            <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Cliente:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[180px]" title={obra.contratante_nome}>
                        {obra.contratante_nome}
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Responsável:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[150px]">
                        {obra.responsavel || 'N/A'}
                    </span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-100 dark:border-slate-700 pt-1">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">Valor:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(obra.valor_inicial)}</span>
                </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    {/* Espaço para ações rápidas se necessário */}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 dark:text-slate-400"
                        onClick={() => handleDuplicateClick(obra)}
                        title="Duplicar"
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 dark:text-slate-400"
                        onClick={() => navigate(`/app/obras/${obra.id}/edit`)}
                        title="Editar"
                    >
                        <Edit className="w-4 h-4" />
                    </Button>
                    {/*
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => handleDeleteObra(obra.id, obra.obra)}
                        title="Excluir"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    */}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <Building className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                        <span className="gradient-text">Lista de Obras</span>
                    </h1>
                    <p className="text-slate-600 mt-2 text-sm sm:text-base">Gerencie as obras e centros de custo da empresa.</p>
                </div>
                <Button
                    onClick={() => navigate('/app/obras/new')}
                    className="save-button w-full sm:w-auto"
                >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Nova Obra
                </Button>
            </div>

            {/* Filtros */}
            <div className="bg-white/80 p-4 rounded-xl shadow-sm border border-white dark:bg-slate-800/80 dark:border-slate-700">
                {/* Botão de filtros mobile */}
                <div className="md:hidden flex justify-between items-center mb-4 last:mb-0">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">Filtros</h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 dark:border-slate-600 dark:text-slate-300"
                    >
                        <Filter className="w-4 h-4" />
                        {showFilters ? 'Ocultar' : 'Mostrar'}
                    </Button>
                </div>

                <div className={`${!showFilters ? 'hidden md:block' : 'block'}`}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Buscar por nome da obra, contratante ou responsável..."
                            className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 placeholder:dark:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
            ) : (
                <>
                    <div className="hidden md:block data-table-container">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer w-[80px]" onClick={() => handleSort('codigo')}>
                                        <div className="flex items-center">Código {renderSortIcon('codigo')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer w-[200px]" onClick={() => handleSort('obra')}>
                                        <div className="flex items-center">Nome da Obra {renderSortIcon('obra')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer w-[280px]" onClick={() => handleSort('contratante_nome')}>
                                        <div className="flex items-center">Cliente {renderSortIcon('contratante_nome')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer w-[180px]" onClick={() => handleSort('responsavel')}>
                                        <div className="flex items-center">Responsável {renderSortIcon('responsavel')}</div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer w-[120px]" onClick={() => handleSort('status')}>
                                        <div className="flex items-center">Status {renderSortIcon('status')}</div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer w-[130px]" onClick={() => handleSort('valor_inicial')}>
                                        <div className="flex items-center justify-end">Valor {renderSortIcon('valor_inicial')}</div>
                                    </TableHead>
                                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedObras.map((obra) => (
                                    <TableRow key={obra.id}>
                                        <TableCell className="font-medium">{obra.codigo}</TableCell>
                                        <TableCell className="truncate" title={obra.obra}>{obra.obra}</TableCell>
                                        <TableCell className="truncate" title={obra.contratante_nome}>{obra.contratante_nome}</TableCell>
                                        <TableCell className="truncate" title={obra.responsavel}>{obra.responsavel}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(obra.status)}`}>
                                                {getStatusText(obra.status)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">{formatCurrency(obra.valor_inicial)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleDuplicateClick(obra)} title="Duplicar">
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/app/obras/${obra.id}/edit`)} title="Editar">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                {/*
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDeleteObra(obra.id, obra.obra)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                                */}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="md:hidden">
                        {paginatedObras.map((obra) => (
                            <ObraCard key={obra.id} obra={obra} />
                        ))}
                    </div>
                </>
            )}

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
            />

            <AdminValidationDialog
                isOpen={isValidationOpen}
                onClose={() => setIsValidationOpen(false)}
                onValidate={confirmDelete}
                title="Confirmar Exclusão de Obra"
                description={`Você está excluindo a obra "${obraToDelete?.nome}". Esta ação é irreversível e exige validação administrativa.`}
            />

            <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicar Obra</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja criar uma cópia da obra <strong>"{obraToDuplicate?.obra}"</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={duplicating}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDuplicate(); }} disabled={duplicating}>
                            {duplicating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Duplicando...
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Confirmar
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ObrasList;

