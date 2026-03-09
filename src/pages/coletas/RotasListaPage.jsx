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
    Pencil,
    CheckCircle,
    XCircle,
    Clock,
    MapPin,
    Navigation,
    Filter
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useProfile } from '@/contexts/ProfileContext';
import { useToast } from '@/components/ui/use-toast';
import { useLocationData } from '@/hooks/useLocationData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
    const [selectedItemIds, setSelectedItemIds] = useState([]);

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
        const { error } = await supabase.from('rotas').delete().eq('id', id);
        if (error) {
            toast({ variant: "destructive", title: "Erro ao excluir rota" });
        } else {
            toast({ title: "Rota excluída com sucesso" });
            fetchRotas();
        }
    };

    const handleOpenEdit = async (rota) => {
        setEditingRota(rota);
        setEditData({
            coletor_id: rota.coletor_id,
            data_planejada: rota.data_planejada,
            status: rota.status || 'pendente'
        });
        setSelectedItemIds(rota.itens?.map(i => i.id) || []);
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
            // 1. Atualizar dados básicos da rota
            const { error: updateError } = await supabase
                .from('rotas')
                .update({
                    coletor_id: editData.coletor_id,
                    data_planejada: editData.data_planejada,
                    status: editData.status
                })
                .eq('id', editingRota.id);

            if (updateError) throw updateError;

            // 2. Remover itens desmarcados (se houver)
            const internalIds = editingRota.itens.map(i => i.id);
            const toRemove = internalIds.filter(id => !selectedItemIds.includes(id));

            if (toRemove.length > 0) {
                const { error: deleteError } = await supabase
                    .from('rota_clientes')
                    .delete()
                    .in('id', toRemove);

                if (deleteError) throw deleteError;
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
            const { error } = await supabase
                .from('rota_clientes')
                .update({ status: newStatus })
                .eq('id', itemId);

            if (error) throw error;

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

    const toggleItemSelection = (id) => {
        setSelectedItemIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleGroupSelection = (items) => {
        const itemIds = items.map(i => i.id);
        const allSelected = itemIds.every(id => selectedItemIds.includes(id));

        if (allSelected) {
            setSelectedItemIds(prev => prev.filter(id => !itemIds.includes(id)));
        } else {
            setSelectedItemIds(prev => [...new Set([...prev, ...itemIds])]);
        }
    };

    const handleOpenGps = () => {
        if (!editingRota || !editingRota.itens || editingRota.itens.length === 0) return;

        // Ordenar itens pela ordem definida
        const sortedItens = [...editingRota.itens].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

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

                {/* Tabela */}
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
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
                                    <TableCell colSpan={5} className="text-center h-48 text-slate-500">
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
                                                className="h-8 w-8 text-blue-400 hover:bg-blue-400/10"
                                                onClick={() => handleOpenEdit(rota)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-500/10">
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="bg-slate-900 border-white/10 text-white">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Excluir Rota?</AlertDialogTitle>
                                                        <AlertDialogDescription className="text-slate-400">
                                                            Esta ação excluirá permanentemente a rota e todos os seus itens vinculados.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="bg-transparent border-white/10 text-white hover:bg-white/5">Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteRota(rota.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Modal de Edição */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="bg-slate-900 border-white/10 text-white max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
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
                                        className="w-full h-10 bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                                        value={editData.status || 'pendente'}
                                        onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value }))}
                                        disabled={profile?.role === 'coletor'}
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
                                                <Checkbox
                                                    checked={items.length > 0 && items.every(i => selectedItemIds.includes(i.id))}
                                                    onCheckedChange={() => toggleGroupSelection(items)}
                                                    className="rounded-full w-5 h-5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-transparent disabled:opacity-30"
                                                    disabled={profile?.role === 'coletor'}
                                                />
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
                                                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all cursor-pointer"
                                                    onClick={() => toggleItemSelection(item.id)}
                                                >
                                                    <Checkbox
                                                        checked={selectedItemIds.includes(item.id)}
                                                        onCheckedChange={() => toggleItemSelection(item.id)}
                                                        className="rounded-full w-5 h-5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-transparent disabled:opacity-30"
                                                        disabled={profile?.role === 'coletor'}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                        <User className="w-4 h-4 text-emerald-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-semibold text-white truncate">
                                                                {item.cliente?.nome_fantasia || item.cliente?.razao_social}
                                                            </p>
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${item.status === 'concluida' ? 'bg-emerald-500/20 text-emerald-400' :
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

                                                    {/* Ações Rápidas de Roteiro */}
                                                    <div className="flex bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemStatus(item.id, 'remarcada'); }}
                                                            className="flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group"
                                                            title="Remarcar"
                                                        >
                                                            <Clock className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">REMARCAR</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemStatus(item.id, 'pulada'); }}
                                                            className="flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group border-x border-white/10"
                                                            title="Pular"
                                                        >
                                                            <XCircle className="w-4 h-4 text-red-500 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">PULAR</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemStatus(item.id, 'concluida'); }}
                                                            className="flex flex-col items-center justify-center px-4 py-2 hover:bg-white/5 transition-colors group"
                                                            title="Concluir"
                                                        >
                                                            <CheckCircle className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                                                            <span className="text-[8px] text-slate-500 mt-1">CONCLUIR</span>
                                                        </button>
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
            </div >
        </>
    );
};

export default RotasListaPage;
