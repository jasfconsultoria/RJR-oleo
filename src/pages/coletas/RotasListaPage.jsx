import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
    Truck,
    Search,
    Loader2,
    Calendar,
    User,
    Trash2,
    Eye,
    ChevronDown,
    ChevronUp,
    Edit,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    Navigation,
    Filter,
    ClipboardList
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/components/ui/use-toast';
import { useLocationData } from '@/hooks/useLocationData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { logAction } from '@/lib/logger';
import AdminConfirmationDialog from '@/components/financeiro/AdminConfirmationDialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Label } from '@/components/ui/label';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import RotasFilters from '@/components/coletas/RotasFilters';

const RotasListaPage = () => {
    const { profile } = useProfile();
    const { toast } = useToast();
    const [rotas, setRotas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [collectors, setCollectors] = useState([]);

    // Edição
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingRota, setEditingRota] = useState(null);
    const [editData, setEditData] = useState({
        coletor_id: '',
        data_planejada: ''
    });
    const [updating, setUpdating] = useState(false);

    // Exclusão com confirmação de 2º Admin
    const [isAdminConfirmationOpen, setIsAdminConfirmationOpen] = useState(false);
    const [rotaToDelete, setRotaToDelete] = useState(null);

    const { fetchMunicipiosByCodes } = useLocationData();
    const [municipiosMap, setMunicipiosMap] = useState({});

    // Filtros
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [filterCollector, setFilterCollector] = useState('todos');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCollectors = useCallback(async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'coletor');
        if (!error) setCollectors(data || []);
    }, []);

    const fetchRotas = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('rotas')
                .select(`
                    *,
                    coletor:profiles(full_name),
                    itens:rota_clientes(
                        id,
                        status,
                        ordem,
                        cliente:clientes(
                            nome_fantasia, 
                            razao_social, 
                            estado, 
                            municipio,
                            endereco,
                            latitude,
                            longitude
                        )
                    )
                `)
                .gte('data_planejada', startDate)
                .lte('data_planejada', endDate)
                .order('data_planejada', { ascending: false });

            if (profile?.role === 'coletor') {
                query = query.eq('coletor_id', profile.id);
            } else if (filterCollector !== 'todos') {
                query = query.eq('coletor_id', filterCollector);
            }

            const { data, error } = await query;

            if (error) throw error;

            let filteredData = data || [];
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredData = filteredData.filter(rota =>
                    rota.itens.some(item =>
                        item.cliente?.nome_fantasia?.toLowerCase().includes(term) ||
                        item.cliente?.razao_social?.toLowerCase().includes(term)
                    )
                );
            }

            setRotas(filteredData);
        } catch (error) {
            console.error('Erro ao buscar rotas:', error);
            toast({ variant: "destructive", title: "Erro ao buscar rotas", description: error.message });
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, filterCollector, searchTerm, toast]);

    useEffect(() => {
        fetchCollectors();
        fetchRotas();
    }, [fetchCollectors, fetchRotas]);

    const handleDeleteRota = async (id) => {
        // Agora apenas prepara para a confirmação
        const rota = rotas.find(r => r.id === id);
        setRotaToDelete(rota);
        setIsAdminConfirmationOpen(true);
    };

    const handleConfirmDeletion = async (secondAdmin) => {
        if (!rotaToDelete) return;

        setLoading(true);
        try {
            const { error } = await supabase.from('rotas').delete().eq('id', rotaToDelete.id);
            if (error) throw error;

            await logAction('delete_rota', {
                details: {
                    rota_id: rotaToDelete.id,
                    data_planejada: rotaToDelete.data_planejada,
                    coletor: rotaToDelete.coletor?.full_name,
                    confirmed_by_admin_id: secondAdmin.id,
                    confirmed_by_admin_name: secondAdmin.name
                }
            });

            toast({ title: "Rota excluída com sucesso", description: `Confirmado por ${secondAdmin.name}` });
            fetchRotas();
        } catch (error) {
            console.error('Erro ao excluir rota:', error);
            toast({ variant: "destructive", title: "Erro ao excluir rota", description: error.message });
        } finally {
            setLoading(false);
            setRotaToDelete(null);
        }
    };

    const handleOpenEdit = async (rota) => {
        setEditingRota(rota);
        setEditData({
            coletor_id: rota.coletor_id,
            data_planejada: rota.data_planejada,
            status: rota.status || 'pendente'
        });
        setIsEditOpen(true);

        // Resolver nomes de municípios para os itens desta rota
        const cityCodes = [...new Set(rota.itens.map(i => i.cliente?.municipio).filter(c => c && !isNaN(c)))];
        if (cityCodes.length > 0) {
            const mapping = await fetchMunicipiosByCodes(cityCodes);
            setMunicipiosMap(prev => ({ ...prev, ...mapping }));
        }
    };

    const handleUpdateRota = async () => {
        if (!editingRota) return;
        setUpdating(true);
        try {
            // Calcular o status automático baseado nos itens que estão na rota
            const remainingItems = editingRota.itens;
            let finalStatus = editData.status;

            if (remainingItems.length > 0) {
                const allConcluida = remainingItems.every(i => i.status === 'concluida');
                const someConcluida = remainingItems.some(i => i.status === 'concluida');

                if (allConcluida) {
                    finalStatus = 'concluida';
                } else if (someConcluida) {
                    finalStatus = 'em_progresso';
                }
            }

            // 1. Atualizar dados básicos da rota
            const { data, error: updateError } = await supabase
                .from('rotas')
                .update({
                    coletor_id: editData.coletor_id,
                    data_planejada: editData.data_planejada,
                    status: finalStatus
                })
                .eq('id', editingRota.id)
                .select();

            if (updateError) throw updateError;
            if (!data || data.length === 0) {
                throw new Error("Não foi possível atualizar a rota. RLS pode estar bloqueando a atualização.");
            }

            toast({ title: "Rota atualizada com sucesso" });
            setIsEditOpen(false);
            fetchRotas();
        } catch (error) {
            console.error('Erro ao atualizar rota:', error);
            toast({ variant: "destructive", title: "Erro ao atualizar rota", description: error.message });
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateItemStatus = async (itemId, newStatus) => {
        try {
            const { data, error } = await supabase
                .from('rota_clientes')
                .update({ status: newStatus })
                .eq('id', itemId)
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Não foi possível atualizar o item. RLS pode estar bloqueando a atualização.");
            }

            toast({ title: "Status atualizado", description: `Item marcado como ${newStatus}` });

            // Atualizar o estado local para refletir a mudança sem fechar o modal
            setEditingRota(prev => ({
                ...prev,
                itens: prev.itens.map(item =>
                    item.id === itemId ? { ...item, status: newStatus } : item
                )
            }));

            // Recarregar a lista silenciosamente
            fetchRotas();
        } catch (error) {
            console.error('Erro ao atualizar status do item:', error);
            toast({ variant: "destructive", title: "Erro ao atualizar status", description: error.message });
        }
    };

    const groupedItems = useMemo(() => {
        if (!editingRota || !editingRota.itens) return {};
        const groups = {};
        editingRota.itens.forEach(item => {
            const c = item.cliente;
            if (!c) return;
            const cityName = municipiosMap[c.municipio] || c.municipio || 'S/M';
            const key = `${c.estado || 'S/E'} - ${cityName}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [editingRota, municipiosMap]);

    const handleRemoveItem = async (itemId) => {
        if (!window.confirm("Deseja realmente remover este cliente do roteiro?")) return;
        try {
            const { error } = await supabase.from('rota_clientes').delete().eq('id', itemId);
            if (error) throw error;
            toast({ title: "Cliente removido da rota" });

            setEditingRota(prev => ({
                ...prev,
                itens: prev.itens.filter(i => i.id !== itemId)
            }));
            fetchRotas();
        } catch (error) {
            console.error('Erro ao remover cliente:', error);
            toast({ variant: "destructive", title: "Erro ao remover", description: error.message });
        }
    };

    const handleOpenClientGps = (cliente) => {
        if (!cliente) return;

        // Priorizar latitude/longitude se disponível
        let query = '';
        if (cliente.latitude && cliente.longitude) {
            query = `${cliente.latitude},${cliente.longitude}`;
        } else {
            // Caso contrário, usar endereço completo
            const cityName = municipiosMap[cliente.municipio] || cliente.municipio || '';
            const address = `${cliente.endereco || ''} ${cityName} ${cliente.estado || ''}`.trim();
            if (address) query = address;
        }

        if (!query) {
            toast({
                variant: "destructive",
                title: "Localização não encontrada",
                description: "Este cliente não possui endereço ou coordenadas cadastradas."
            });
            return;
        }

        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    };

    const handleOpenGps = (externalRota = null) => {
        // Se a chamada vier com uma rota (ex: botão da tabela principal), usa ela. Se não usa a que está aberta.
        const targetRota = externalRota || editingRota;

        if (!targetRota || !targetRota.itens || targetRota.itens.length === 0) {
            toast({
                variant: "destructive",
                title: "Rota vazia",
                description: "Não existem clientes vinculados a esta rota para gerar o trajeto."
            });
            return;
        }

        // Ordenar itens pela ordem definida
        const sortedItens = [...targetRota.itens].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        // Filtrar clientes que possuem alguma forma de localização
        const waypoints = sortedItens
            .map(item => {
                const c = item.cliente;
                if (!c) return null;

                // Priorizar latitude/longitude se disponível
                if (c.latitude && c.longitude) {
                    return `${c.latitude},${c.longitude}`;
                }

                // Caso contrário, usar endereço completo
                if (c.endereco) {
                    const cityName = municipiosMap[c.municipio] || c.municipio || '';
                    return `${c.endereco}, ${cityName} - ${c.estado}`;
                }

                return null;
            })
            .filter(Boolean);

        if (waypoints.length === 0) {
            toast({
                variant: "destructive",
                title: "Localização não encontrada",
                description: "Nenhum cliente nesta rota possui endereço ou coordenadas cadastradas."
            });
            return;
        }

        // Construir a URL do Google Maps
        // Deixando o origin vazio, o Google Maps utiliza a localização atual do dispositivo
        let url = "";
        if (waypoints.length === 1) {
            url = `https://www.google.com/maps/dir/?api=1&origin=&destination=${encodeURIComponent(waypoints[0])}&travelmode=driving`;
        } else {
            // O destino final é o último waypoint da lista
            const destination = waypoints[waypoints.length - 1];
            // Todos os clientes que vêm antes do último viram waypoints intermediários
            const transitPoints = waypoints.slice(0, -1).join('|');

            url = `https://www.google.com/maps/dir/?api=1&origin=&destination=${encodeURIComponent(destination)}`;
            if (transitPoints) {
                url += `&waypoints=${encodeURIComponent(transitPoints)}`;
            }
            url += `&travelmode=driving`;
        }

        window.open(url, '_blank');
    };

    return (
        <>
            <Helmet>
                <title>Rotas de Coletas - Sistema RJR Óleo</title>
            </Helmet>

            <div className="space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row items-center justify-between gap-4"
                >
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                            <Truck className="w-8 h-8 text-emerald-400" />
                            Rotas de Coletas
                            <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 border-none ml-2">
                                {profile?.role === 'coletor' ? 'Minhas Rotas' : 'Todas as Rotas'}
                            </Badge>
                        </h1>
                        <p className="text-emerald-200/80 mt-1">Gerencie as rotas planejadas e atribuídas aos coletores.</p>
                    </div>
                </motion.div>

                {/* Filtros */}
                <RotasFilters
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    filterCollector={filterCollector}
                    setFilterCollector={setFilterCollector}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    collectors={collectors}
                    role={profile?.role}
                />

                {/* Visualização em Tabela (Desktop) */}
                <div className="hidden lg:block bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                    <Table>
                        <TableHeader className="bg-white/5">
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="text-emerald-400">Código</TableHead>
                                <TableHead className="text-emerald-400">Data Planejada</TableHead>
                                <TableHead className="text-emerald-400">Coletor</TableHead>
                                <TableHead className="text-emerald-400">Coletas</TableHead>
                                <TableHead className="text-emerald-400">Status</TableHead>
                                <TableHead className="text-right text-emerald-400">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-48">
                                        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                                    </TableCell>
                                </TableRow>
                            ) : rotas.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-48 text-slate-500">
                                        Nenhuma rota encontrada para os filtros selecionados.
                                    </TableCell>
                                </TableRow>
                            ) : rotas.map((rota) => (
                                <TableRow key={rota.id} className="border-white/5 hover:bg-white/5 transition-colors group">
                                    <TableCell>
                                        <span className="font-mono text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg tracking-wider">
                                            #{rota.id.slice(0, 8).toUpperCase()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-white font-medium">
                                        {format(parseISO(rota.data_planejada), 'dd/MM/yyyy')}
                                    </TableCell>
                                    <TableCell className="text-slate-300">
                                        {rota.coletor?.full_name || 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-slate-300">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold">{rota.itens?.length || 0}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${rota.status === 'concluida' ? 'bg-emerald-500/20 text-emerald-400' :
                                            rota.status === 'em_progresso' ? 'bg-blue-500/20 text-blue-400' :
                                                'bg-slate-500/20 text-slate-400'
                                            }`}>
                                            {rota.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-emerald-400 hover:bg-emerald-400/10"
                                                onClick={() => handleOpenGps(rota)}
                                                title="Abrir GPS da Rota"
                                            >
                                                <MapPin className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-yellow-400 hover:bg-yellow-400/10"
                                                onClick={() => handleOpenEdit(rota)}
                                                title="Editar Rota"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                onClick={() => handleDeleteRota(rota.id)}
                                                title="Excluir Rota"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Visualização em Cards (Mobile) */}
                <div className="lg:hidden space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 bg-white/5 rounded-xl border border-white/10">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                            <p className="text-emerald-400 text-sm">Carregando rotas...</p>
                        </div>
                    ) : rotas.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10 text-slate-500">
                            <Truck className="w-8 h-8 mx-auto opacity-20 mb-2" />
                            <p>Nenhuma rota encontrada para os filtros selecionados.</p>
                        </div>
                    ) : (
                        rotas.map((rota) => (
                            <motion.div
                                key={rota.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 space-y-4 shadow-xl"
                            >
                                {/* Cabeçalho do Card */}
                                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <ClipboardList className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <span className="font-mono text-xs font-bold text-emerald-400 tracking-wider">
                                            #{rota.id.slice(0, 8).toUpperCase()}
                                        </span>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${rota.status === 'concluida' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' :
                                        rota.status === 'em_progresso' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' :
                                            'bg-slate-500/20 text-slate-400 border border-white/5'
                                        }`}>
                                        {rota.status}
                                    </span>
                                </div>

                                {/* Conteúdo do Card */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                            <Calendar className="w-3 h-3 text-emerald-400" />
                                            Data Planejada
                                        </div>
                                        <p className="text-sm font-semibold text-white">
                                            {format(parseISO(rota.data_planejada), 'dd/MM/yyyy')}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                            <Truck className="w-3 h-3 text-emerald-400" />
                                            Coletas
                                        </div>
                                        <p className="text-sm font-bold text-white">
                                            {rota.itens?.length || 0} vinculadas
                                        </p>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 uppercase font-bold tracking-tight">
                                            <User className="w-3 h-3 text-emerald-400" />
                                            Coletor Responsável
                                        </div>
                                        <p className="text-sm text-slate-200">
                                            {rota.coletor?.full_name || 'Não Atribuído'}
                                        </p>
                                    </div>
                                </div>

                                {/* Ações do Card */}
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-11 gap-2 bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                        onClick={() => handleOpenGps(rota)}
                                    >
                                        <MapPin className="w-4 h-4" />
                                        <span className="text-xs font-bold">GPS Rota</span>
                                    </Button>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 bg-yellow-500/5 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
                                            onClick={() => handleOpenEdit(rota)}
                                            title="Editar Rota"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10"
                                            onClick={() => handleDeleteRota(rota.id)}
                                            title="Excluir Rota"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Modal de Edição */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent aria-describedby={undefined} className="bg-slate-900 border-white/10 text-white max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2">
                            <DialogTitle className="flex items-center gap-2 text-emerald-400">
                                <Truck className="w-5 h-5" />
                                Editar Rota & Código
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                            {/* Dados da Rota */}
                            {/* Linha 1: Código + Data + Status */}
                            <div className="grid grid-cols-12 gap-4">
                                {/* Código */}
                                <div className="col-span-4 space-y-2">
                                    <Label className="text-xs text-slate-400">Código</Label>
                                    <div className="flex items-center h-10 bg-black/10 border border-white/5 rounded-md px-3">
                                        <span className="font-mono text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg tracking-wider">
                                            #{editingRota?.id?.slice(0, 8).toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                {/* Data Planejada (compacta) */}
                                <div className="col-span-4 space-y-2">
                                    <Label className="text-xs text-slate-400">Data Planejada</Label>
                                    <Input
                                        type="date"
                                        value={editData.data_planejada}
                                        onChange={(e) => setEditData(prev => ({ ...prev, data_planejada: e.target.value }))}
                                        className="bg-black/20 border-white/10 text-white"
                                        disabled={profile?.role === 'coletor'}
                                    />
                                </div>
                                {/* Status */}
                                <div className="col-span-4 space-y-2">
                                    <Label className="text-xs text-slate-400">Status</Label>
                                    <select
                                        className="w-full h-10 bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={editData.status || 'pendente'}
                                        onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value }))}
                                        disabled={!['super_admin', 'administrador', 'gerente'].includes(profile?.role)}
                                    >
                                        <option value="pendente" className="bg-slate-900">Pendente</option>
                                        <option value="em_progresso" className="bg-slate-900">Em Progresso</option>
                                        <option value="concluida" className="bg-slate-900">Concluída</option>
                                        <option value="cancelada" className="bg-slate-900">Cancelada</option>
                                    </select>
                                </div>
                            </div>
                            {/* Linha 2: Coletor */}
                            <div className="space-y-2">
                                <Label className="text-xs text-slate-400">Coletor Responsável</Label>
                                <select
                                    className="w-full h-10 bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                    value={editData.coletor_id}
                                    onChange={(e) => setEditData(prev => ({ ...prev, coletor_id: e.target.value }))}
                                    disabled={profile?.role === 'coletor'}
                                >
                                    {collectors.map(col => (
                                        <option key={col.id} value={col.id} className="bg-slate-900">{col.full_name || 'Sem Nome'}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-white/5"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-slate-900 px-2 text-slate-500">Clientes no Roteiro</span>
                                </div>
                            </div>

                            {/* Itens da Rota (Agrupados por Localidade) */}
                            <div className="space-y-4">
                                {Object.entries(groupedItems).map(([location, items]) => (
                                    <div key={location} className="space-y-2">
                                        <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{location}</span>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                {items.length} {items.length === 1 ? 'cliente' : 'clientes'}
                                            </Badge>
                                        </div>
                                        <div className="space-y-2 pl-2">
                                            {items.map(item => (
                                                <div
                                                    key={item.id}
                                                    className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all"
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
                                                            <User className="w-4 h-4 text-emerald-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-sm font-semibold text-white truncate">
                                                                    {item.cliente?.nome_fantasia && item.cliente?.razao_social && item.cliente?.nome_fantasia !== item.cliente?.razao_social
                                                                        ? `${item.cliente?.nome_fantasia} - ${item.cliente?.razao_social}`
                                                                        : (item.cliente?.nome_fantasia || item.cliente?.razao_social)}
                                                                </p>
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase whitespace-nowrap ${item.status === 'concluida' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    item.status === 'em_progresso' ? 'bg-blue-500/20 text-blue-400' :
                                                                        'bg-slate-500/20 text-slate-400'
                                                                    }`}>
                                                                    {item.status || 'Pendente'}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                                {item.cliente?.endereco || 'Endereço não cadastrado'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Ações Rápidas de Roteiro */}
                                                    <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/5 w-full md:w-auto">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenClientGps(item.cliente); }}
                                                            className="flex-1 md:flex-none flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group disabled:opacity-50 disabled:pointer-events-none"
                                                            title="Abrir GPS"
                                                        >
                                                            <MapPin className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">GPS</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemStatus(item.id, 'remarcada'); }}
                                                            className="flex-1 md:flex-none flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group disabled:opacity-50 disabled:pointer-events-none border-l border-white/5 md:border-l-0"
                                                            title="Remarcar"
                                                            disabled={editData.status === 'concluida'}
                                                        >
                                                            <Clock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">REMARCAR</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemStatus(item.id, 'pulada'); }}
                                                            className="flex-1 md:flex-none flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group border-x border-white/10 disabled:opacity-50 disabled:pointer-events-none"
                                                            title="Pular"
                                                            disabled={editData.status === 'concluida'}
                                                        >
                                                            <XCircle className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">PULAR</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemStatus(item.id, 'concluida'); }}
                                                            className="flex-1 md:flex-none flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group border-r border-white/5 md:border-r-0 disabled:opacity-50 disabled:pointer-events-none"
                                                            title="Concluir"
                                                            disabled={editData.status === 'concluida'}
                                                        >
                                                            <CheckCircle className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">CONCLUIR</span>
                                                        </button>
                                                        {['super_admin', 'administrador', 'gerente'].includes(profile?.role) && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                                                                className="flex-1 md:flex-none flex flex-col items-center justify-center px-4 py-2 hover:bg-red-500/10 transition-colors group border-l border-white/10 disabled:opacity-50 disabled:pointer-events-none"
                                                                title="Remover"
                                                                disabled={editData.status === 'concluida'}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                                                                <span className="text-[8px] text-red-500 mt-1">REMOVER</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(groupedItems).length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-8 text-slate-500 space-y-2 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                                        <Truck className="w-8 h-8 opacity-20" />
                                        <p className="text-xs">Nenhum cliente vinculado a esta rota.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter className="p-6 pt-2 gap-2 bg-black/20 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleOpenGps}
                                    className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                                    disabled={!editingRota?.itens?.length}
                                >
                                    <Navigation className="w-4 h-4 mr-2" />
                                    Abrir GPS
                                </Button>
                                <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="text-white hover:bg-white/5" disabled={updating}>
                                    {profile?.role === 'coletor' ? 'Fechar' : 'Cancelar'}
                                </Button>
                            </div>
                            {profile?.role !== 'coletor' && (
                                <Button
                                    onClick={handleUpdateRota}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={updating}
                                >
                                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Salvar Alterações
                                </Button>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <AdminConfirmationDialog
                    isOpen={isAdminConfirmationOpen}
                    onClose={() => setIsAdminConfirmationOpen(false)}
                    onConfirm={handleConfirmDeletion}
                    currentUserId={profile?.id}
                    documentInfo={`Rota #${rotaToDelete?.id?.slice(0, 8).toUpperCase()} - ${rotaToDelete ? format(parseISO(rotaToDelete.data_planejada), 'dd/MM/yyyy') : ''}`}
                />
            </div >
        </>
    );
};

export default RotasListaPage;
