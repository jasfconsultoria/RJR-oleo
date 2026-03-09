import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { format, addDays, parseISO } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import {
    Loader2,
    Truck,
    Navigation,
    ArrowLeft,
    Phone,
    MapPin,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from '@/components/ui/use-toast';
import { useLocationData } from '@/hooks/useLocationData';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const RoteiroOperacionalPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [finalizedIds, setFinalizedIds] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]); // IDs selecionados para salvar
    const [isSaveRouteOpen, setIsSaveRouteOpen] = useState(false);
    const [collectors, setCollectors] = useState([]);
    const [selectedCollector, setSelectedCollector] = useState('');
    const [saving, setSaving] = useState(false);

    const { fetchMunicipiosByCodes } = useLocationData();
    const [municipiosMap, setMunicipiosMap] = useState({});

    const clientIds = location.state?.clientIds || [];

    const fetchClientesRoteiro = useCallback(async () => {
        if (!clientIds || clientIds.length === 0) {
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .in('id', clientIds);

            if (error) throw error;

            // Reordenar para manter a ordem da seleção se possível, ou por proximidade (simples por agora)
            const ordered = clientIds.map(id => data.find(c => c.id === id)).filter(Boolean);
            setClientes(ordered);

            // Buscar nomes dos municípios baseados nos códigos IBGE
            const cityCodes = [...new Set(ordered.map(c => c.municipio).filter(id => id && !isNaN(id)))];
            if (cityCodes.length > 0) {
                const citiesData = await fetchMunicipiosByCodes(cityCodes);
                setMunicipiosMap(citiesData);
            }
        } catch (error) {
            console.error('Erro ao buscar roteiro:', error);
            toast({ variant: "destructive", title: "Erro ao carregar roteiro", description: error.message });
        } finally {
            setLoading(false);
        }
    }, [clientIds, toast, fetchMunicipiosByCodes]);

    const fetchCollectors = useCallback(async () => {
        const { data, error } = await supabase.rpc('get_all_users');

        if (!error && data) {
            const coletores = data.filter(u => u.role === 'coletor');
            setCollectors(coletores);
        } else if (error) {
            console.error('Erro ao buscar coletores:', error);
        }
    }, []);

    useEffect(() => {
        fetchClientesRoteiro();
        fetchCollectors();
    }, [fetchClientesRoteiro, fetchCollectors]);

    // Agrupamento por Estado e Município
    const groupedClientes = useMemo(() => {
        const groups = {};
        clientes.forEach(c => {
            const cityName = municipiosMap[c.municipio] || c.municipio || 'S/M';
            const key = `${c.estado || 'S/E'} - ${cityName}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(c);
        });
        return groups;
    }, [clientes, municipiosMap]);

    const toggleSelection = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSaveRoute = async () => {
        if (!selectedCollector) {
            toast({ variant: "destructive", title: "Selecione um coletor" });
            return;
        }

        setSaving(true);
        try {
            // 1. Criar a rota no cabeçalho
            const { data: rota, error: rotaError } = await supabase
                .from('rotas')
                .insert({
                    coletor_id: selectedCollector,
                    data_planejada: format(new Date(), "yyyy-MM-dd"),
                    status: 'pendente'
                })
                .select()
                .single();

            if (rotaError) throw rotaError;

            // 2. Criar os itens da rota
            const rotaItens = selectedIds.map((id, index) => ({
                rota_id: rota.id,
                cliente_id: id,
                ordem: index + 1,
                status: 'pendente'
            }));

            const { error: itensError } = await supabase
                .from('rota_clientes')
                .insert(rotaItens);

            if (itensError) throw itensError;

            toast({ title: "Rota salva com sucesso!", description: "A rota foi atribuída ao coletor selecionado." });
            setIsSaveRouteOpen(false);

            // Remove os clientes salvos da lista em tela para continuar marcando os próximos
            setClientes(prev => prev.filter(c => !selectedIds.includes(c.id)));
            // Limpa as seleções para o prox roteiro
            setSelectedIds([]);
        } catch (error) {
            console.error('Erro ao salvar rota:', error);
            toast({ variant: "destructive", title: "Erro ao salvar rota", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleOpenMap = (cliente) => {
        const query = encodeURIComponent(`${cliente.endereco} ${cliente.municipio} ${cliente.estado}`);
        window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    };

    const handleCall = (telefone) => {
        if (!telefone) return;
        window.open(`tel:${telefone.replace(/\D/g, '')}`, '_self');
    };

    const handleAction = (type, cliente) => {
        if (type === 'concluir') {
            navigate('/app/coletas/nova', { state: { preselectClienteId: cliente.id } });
        } else if (type === 'remarcar') {
            setSelectedForAction(cliente);
            setIsRescheduleOpen(true);
        } else if (type === 'pular') {
            toast({ title: "Cliente pulado", description: "O cliente foi ignorado neste roteiro." });
            setFinalizedIds(prev => [...prev, cliente.id]);
        }
    };

    const handleReschedule = async () => {
        if (!selectedForAction || !rescheduleDate) return;

        try {
            const { error } = await supabase
                .from('clientes')
                .update({ proxima_coleta_prevista: new Date(`${rescheduleDate}T12:00:00Z`).toISOString() })
                .eq('id', selectedForAction.id);

            if (error) throw error;

            toast({ title: "Reagendado!", description: `Nova coleta para ${selectedForAction.nome_fantasia || selectedForAction.razao_social} em ${format(parseISO(rescheduleDate), 'dd/MM/yyyy')}` });
            setFinalizedIds(prev => [...prev, selectedForAction.id]);
            setIsRescheduleOpen(false);
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao reagendar", description: error.message });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-white">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
                <p>Carregando seu roteiro...</p>
            </div>
        );
    }

    if (clientes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <Truck className="w-16 h-16 text-emerald-500/20 mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Sem roteiro ativo</h2>
                <p className="text-slate-400 mb-6">Selecione clientes na Agenda Operacional para gerar uma rota de trabalho.</p>
                <Button onClick={() => navigate('/app/agenda')} className="bg-emerald-600 hover:bg-emerald-700">
                    Ir para Agenda
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-20">
            <Helmet>
                <title>Roteiro do Dia - RJR Óleo</title>
            </Helmet>

            <div className="flex items-center justify-between gap-4 sticky top-0 bg-slate-900/80 backdrop-blur-md p-2 z-20 rounded-xl border border-white/5">
                <Button variant="ghost" size="icon" onClick={() => navigate('/app/agenda')} className="text-white">
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <div className="text-center">
                    <h1 className="text-lg font-bold text-white">Roteiro Operacional</h1>
                    <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">
                        {finalizedIds.length} / {clientes.length} CONCLUÍDOS
                    </p>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            <div className="space-y-8">
                {Object.entries(groupedClientes).map(([groupKey, groupClientes]) => {
                    const allSelected = groupClientes.every(c => selectedIds.includes(c.id));
                    const someSelected = groupClientes.some(c => selectedIds.includes(c.id));

                    return (
                        <div key={groupKey} className="space-y-3">
                            <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm sticky top-14 z-10">
                                <div className="flex items-center gap-3">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={(checked) => {
                                            const ids = groupClientes.map(c => c.id);
                                            if (checked) {
                                                setSelectedIds(prev => [...new Set([...prev, ...ids])]);
                                            } else {
                                                setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                                            }
                                        }}
                                        className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                    />
                                    <div>
                                        <h2 className="text-sm font-bold text-white uppercase tracking-wider">{groupKey}</h2>
                                        <p className="text-[10px] text-slate-400">{groupClientes.length} clientes neste grupo</p>
                                    </div>
                                </div>
                                {someSelected && (
                                    <Button
                                        size="sm"
                                        onClick={() => setIsSaveRouteOpen(true)}
                                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold gap-2"
                                    >
                                        <Truck className="w-3.5 h-3.5" /> Salvar Roteiro
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-4 pl-4 border-l border-white/5 ml-2">
                                {groupClientes.map((cliente, index) => {
                                    const isFinalized = finalizedIds.includes(cliente.id);
                                    const isSelected = selectedIds.includes(cliente.id);

                                    return (
                                        <motion.div
                                            key={cliente.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="flex gap-3"
                                        >
                                            <div className="pt-4">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleSelection(cliente.id)}
                                                    className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                />
                                            </div>
                                            <Card className={`flex-1 overflow-hidden border-white/10 transition-all ${isFinalized ? 'bg-emerald-900/20 opacity-60 grayscale' : 'bg-white/5 shadow-xl'}`}>
                                                <CardContent className="p-0">
                                                    <div className="p-4 space-y-3">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h2 className="text-base font-bold text-white truncate leading-none">
                                                                        {cliente.nome_fantasia || cliente.razao_social}
                                                                    </h2>
                                                                </div>
                                                                <p className="text-[11px] text-slate-400 flex items-start gap-1">
                                                                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                                                                    {cliente.endereco || 'Endereço não informado'}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {cliente.telefone && (
                                                                    <Button
                                                                        variant="secondary"
                                                                        size="icon"
                                                                        className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white"
                                                                        onClick={() => handleCall(cliente.telefone)}
                                                                    >
                                                                        <Phone className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-8 w-8 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                                                    onClick={() => handleOpenMap(cliente)}
                                                                >
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="text-center p-8">
                <p className="text-slate-500 text-xs">Fim do roteiro operacional.</p>
            </div>

            <Dialog open={isSaveRouteOpen} onOpenChange={setIsSaveRouteOpen}>
                <DialogContent aria-describedby={undefined} className="bg-slate-900 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Salvar Roteiro</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Coletor Responsável</Label>
                            <select
                                className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={selectedCollector}
                                onChange={(e) => setSelectedCollector(e.target.value)}
                            >
                                <option value="" className="bg-slate-900">Selecione um coletor...</option>
                                {collectors.map(col => (
                                    <option key={col.id} value={col.id} className="bg-slate-900">{col.full_name || 'Sem Nome'}</option>
                                ))}
                            </select>
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Serão salvos {selectedIds.length} clientes neste roteiro para o coletor selecionado.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setIsSaveRouteOpen(false)} className="text-white hover:bg-white/5" disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveRoute} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving || !selectedCollector}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
                            Salvar Roteiro
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RoteiroOperacionalPage;
