"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2,
    Search,
    PlusCircle,
    Edit,
    Trash2,
    CalendarCheck,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Filter,
    CheckCircle2,
    Clock,
    AlertCircle,
    CalendarDays,
    Copy
} from 'lucide-react';
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
import { logAction } from '@/lib/logger';
import Pagination from '@/components/ui/Pagination';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const VisitasList = () => {
    const { user: currentUser, activeCompany } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [visitas, setVisitas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [visitaToDelete, setVisitaToDelete] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    // Estados para duplicação
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [visitaToDuplicate, setVisitaToDuplicate] = useState(null);
    const [duplicating, setDuplicating] = useState(false);

    const ITEMS_PER_PAGE = 10;

    const fetchVisitas = useCallback(async (searchTermParam = '', page = 1) => {
        const searchTermTrimmed = (searchTermParam || '').trim();
        console.log(`[V2-FIX] VisitasList: Buscando "${searchTermTrimmed}" (página ${page})`);
        setLoading(true);

        try {
            if (!activeCompany?.cnpj) {
                setVisitas([]);
                setTotalCount(0);
                setLoading(false);
                return;
            }

            const cnpjLimpo = activeCompany.cnpj.replace(/\D/g, '');
            const offset = (page - 1) * ITEMS_PER_PAGE;

            // Para filtrar por uma tabela relacionada no .or(), o PostgREST muitas vezes 
            // exige que a relação use !inner para garantir o JOIN correto.
            let query = supabase
                .from('obras_visitas')
                .select(`
                    *,
                    obras!inner (
                        obra,
                        endereco,
                        municipio,
                        cep,
                        latitude,
                        longitude
                    )
                `, { count: 'exact' })
                .eq('empresa', cnpjLimpo)
                .order('data_visita', { ascending: false })
                .range(offset, offset + ITEMS_PER_PAGE - 1);

            if (searchTermTrimmed) {
                // SINTAXE CRÍTICA: Sem espaços após a vírgula.
                // Usamos aspas simples para envolver toda a string do .or()
                // e o valor do ilike não precisa de aspas se não houver caracteres especiais no termo,
                // mas vamos garantir que o termo seja limpo.
                const term = `%${searchTermTrimmed}%`;
                query = query.or(`observacoes.ilike.${term},obras.obra.ilike.${term}`);
            }

            const { data, error, count } = await query;

            if (error) {
                console.error('[V2-FIX] VisitasList: Erro na consulta:', error);
                throw error;
            }

            setVisitas(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('[V2-FIX] VisitasList: Erro fatal:', error);
            toast({
                variant: "destructive",
                title: "Erro ao carregar visitas",
                description: error.message,
            });
        } finally {
            setLoading(false);
            console.log('[V2-FIX] VisitasList: Carregamento finalizado.');
        }
    }, [toast, activeCompany]);

    useEffect(() => {
        fetchVisitas(searchTerm, currentPage);
    }, [fetchVisitas, searchTerm, currentPage]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 1: // Aguardando
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Clock className="w-3 h-3" /> Aguardando</Badge>;
            case 2: // Concluída
                return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="w-3 h-3" /> Concluída</Badge>;
            case 3: // Remarcada
                return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><CalendarDays className="w-3 h-3" /> Remarcada</Badge>;
            case 4: // Cancelada
                return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1"><AlertCircle className="w-3 h-3" /> Cancelada</Badge>;
            default:
                return <Badge variant="secondary">Desconhecido</Badge>;
        }
    };

    // Componente de Card para Mobile
    const VisitaCard = ({ visita }) => (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 dark:text-blue-400 truncate max-w-[200px]">
                        {visita.obras?.obra || 'Obra não vinculada'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(visita.data_visita), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {getStatusBadge(visita.status)}
                </div>
            </div>

            <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Endereço:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate ml-2 max-w-[180px]" title={visita.obras?.endereco}>
                        {visita.obras?.endereco || 'N/A'}
                    </span>
                </div>
                {visita.observacoes && (
                    <div className="flex flex-col text-sm mt-1">
                        <span className="text-slate-500 dark:text-slate-400">Observações:</span>
                        <span className="font-normal text-slate-700 dark:text-slate-300 line-clamp-2 italic">
                            {visita.observacoes}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-blue-600 dark:text-blue-400 flex items-center gap-1"
                        onClick={() => handleOpenMap(visita)}
                    >
                        <MapPin className="w-4 h-4" />
                        Mapa
                    </Button>
                    {visita.status === 1 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-emerald-600 dark:text-emerald-500 flex items-center gap-1"
                            onClick={() => handleConfirmarVisita(visita.id)}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirmar
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 dark:text-slate-400"
                        onClick={() => navigate(`/app/obras/visitas/${visita.id}/editar`)}
                        title="Editar"
                    >
                        <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 dark:text-slate-400"
                        onClick={() => handleDuplicateClick(visita)}
                        title="Duplicar"
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-600 dark:text-slate-400"
                        onClick={() => navigate(`/app/obras/visitas/${visita.id}/editar`)}
                        title="Editar"
                    >
                        <Edit className="w-4 h-4" />
                    </Button>
                    {/*
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => handleDeleteClick(visita)}
                        title="Excluir"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                    */}
                </div>
            </div>
        </div>
    );

    const handleDeleteClick = (visita) => {
        setVisitaToDelete(visita);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!visitaToDelete) return;
        try {
            const { error } = await supabase
                .from('obras_visitas')
                .delete()
                .eq('id', visitaToDelete.id);

            if (error) throw error;

            toast({ title: 'Visita excluída!', description: `A visita foi removida com sucesso.` });
            await logAction('visita_delete', { visita_id: visitaToDelete.id });
            fetchVisitas(searchTerm, currentPage);
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
        } finally {
            setDeleteDialogOpen(false);
            setVisitaToDelete(null);
        }
    };

    const handleDuplicateClick = (visita) => {
        setVisitaToDuplicate(visita);
        setShowDuplicateDialog(true);
    };

    const confirmDuplicate = async () => {
        if (!visitaToDuplicate || !activeCompany?.cnpj) return;
        setDuplicating(true);
        try {
            // Busca dados originais da tabela, pois a view pode não ter tudo mapeado diretamente
            const { data: originalData, error: fetchError } = await supabase
                .from('obras_visitas')
                .select('*')
                .eq('id', visitaToDuplicate.id)
                .single();

            if (fetchError) throw fetchError;

            // Remove campos controlados (id, created_at, updated_at).
            const { id, created_at, updated_at, ...dataToCopy } = originalData;

            // Altera para diferenciar visualmente (Aguardando)
            dataToCopy.status = 1;

            if (dataToCopy.observacoes) {
                dataToCopy.observacoes = `${dataToCopy.observacoes} (Cópia)`;
            } else {
                dataToCopy.observacoes = `(Cópia)`;
            }

            const { error: insertError } = await supabase.from('obras_visitas').insert([dataToCopy]);

            if (insertError) throw insertError;

            toast({ title: 'Visita Duplicada', description: `A visita foi duplicada com sucesso.` });

            await logAction('visita_duplicate', { visita_original_id: visitaToDuplicate.id });

            setShowDuplicateDialog(false);
            setVisitaToDuplicate(null);
            fetchVisitas(searchTerm, currentPage);

        } catch (error) {
            console.error('Erro ao duplicar visita:', error);
            toast({ variant: 'destructive', title: 'Erro ao duplicar', description: error.message });
        } finally {
            setDuplicating(false);
        }
    };

    const handleConfirmarVisita = async (id) => {
        try {
            const { error } = await supabase
                .from('obras_visitas')
                .update({ status: 2 })
                .eq('id', id);

            if (error) throw error;
            toast({ title: 'Visita Confirmada', description: 'O status foi alterado para Concluída.' });
            fetchVisitas(searchTerm, currentPage);
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: error.message });
        }
    };

    const handleOpenMap = (visita) => {
        const { latitude, longitude, endereco, municipio } = visita.obras || {};

        // Se tiver coordenadas, usa elas (mais preciso)
        if (latitude && longitude) {
            window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
            return;
        }

        // Senão, tenta pelo endereço
        if (endereco) {
            const query = encodeURIComponent(`${endereco}${municipio ? `, ${municipio}` : ''}`);
            window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
            return;
        }

        // Fallback: navegação interna se nada mais funcionar
        if (visita.obra_id) {
            navigate(`/app/obras/visitas/nova?obraId=${visita.obra_id}`);
        } else {
            navigate('/app/obras/visitas/nova');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                        <CalendarCheck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                        <span className="gradient-text">Controle de Visitas</span>
                    </h1>
                    <p className="text-slate-600 mt-2 text-sm sm:text-base">Histórico e agendamento de visitas científicas às obras.</p>
                </div>
                <Button
                    onClick={() => navigate('/app/obras/visitas/nova')}
                    className="save-button w-full sm:w-auto"
                >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Nova Visita
                </Button>
            </div>

            <div className="bg-white/80 p-4 rounded-xl shadow-sm border border-white dark:bg-slate-800/80 dark:border-slate-700">
                <div className="flex justify-between items-center md:hidden mb-4">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-300">Filtros</h3>
                    <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                        <Filter className="w-4 h-4 mr-2" /> {showFilters ? 'Ocultar' : 'Mostrar'}
                    </Button>
                </div>

                <div className={`${!showFilters ? 'hidden md:block' : 'block'}`}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                            placeholder="Buscar por obra ou observações..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                                    <TableHead>Data/Hora</TableHead>
                                    <TableHead>Obra</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Endereço</TableHead>
                                    <TableHead>Observações</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visitas.map((v) => (
                                    <TableRow key={v.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(v.data_visita), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate font-semibold">
                                            {v.obras?.obra || 'Obra não vinculada'}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(v.status)}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 p-0 h-auto" onClick={() => handleOpenMap(v)}>
                                                <MapPin className="w-4 h-4 mr-1" />
                                                <span className="max-w-[150px] truncate">{v.obras?.endereco || 'Ver no mapa'}</span>
                                            </Button>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-slate-500 italic" title={v.observacoes}>
                                            {v.observacoes || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {v.status === 1 && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleConfirmarVisita(v.id)} title="Confirmar Realização">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => handleDuplicateClick(v)} title="Duplicar">
                                                    <Copy className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/app/obras/visitas/${v.id}/editar`)} title="Editar/Remarcar">
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                {/*
                                                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteClick(v)} title="Excluir">
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
                        {visitas.map((v) => (
                            <VisitaCard key={v.id} visita={v} />
                        ))}
                    </div>
                </>
            )}

            <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(totalCount / ITEMS_PER_PAGE)}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={totalCount}
                currentItemsCount={visitas.length}
                onPageChange={setCurrentPage}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                        <AlertDialogDescription>Tem certeza que deseja excluir esta visita? Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicar Visita</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja criar uma cópia da visita na obra <strong>"{visitaToDuplicate?.obras?.obra || 'Não Vínculada'}"</strong>?
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

export default VisitasList;
