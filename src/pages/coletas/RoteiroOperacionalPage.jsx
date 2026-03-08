import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { format, addDays, parseISO } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import {
    Loader2,
    Truck,
    Navigation,
    CheckCircle2,
    XCircle,
    Clock,
    ArrowLeft,
    Phone,
    MapPin,
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
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
    const [finalizedIds, setFinalizedIds] = useState([]); // IDs marcados como concluído nesta sessão
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
    const [selectedForAction, setSelectedForAction] = useState(null);

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
        } catch (error) {
            console.error('Erro ao buscar roteiro:', error);
            toast({ variant: "destructive", title: "Erro ao carregar roteiro", description: error.message });
        } finally {
            setLoading(false);
        }
    }, [clientIds, toast]);

    useEffect(() => {
        fetchClientesRoteiro();
    }, [fetchClientesRoteiro]);

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
                <Button onClick={() => navigate('/app/coletas/agenda')} className="bg-emerald-600 hover:bg-emerald-700">
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
                <Button variant="ghost" size="icon" onClick={() => navigate('/app/coletas/agenda')} className="text-white">
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

            <div className="space-y-4">
                {clientes.map((cliente, index) => {
                    const isFinalized = finalizedIds.includes(cliente.id);

                    return (
                        <motion.div
                            key={cliente.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className={`overflow-hidden border-white/10 transition-all ${isFinalized ? 'bg-emerald-900/20 opacity-60 grayscale' : 'bg-white/5 shadow-xl'}`}>
                                <CardContent className="p-0">
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-1.5 py-0 text-[10px]">
                                                        #{index + 1}
                                                    </Badge>
                                                    <h2 className="text-lg font-bold text-white truncate leading-none">
                                                        {cliente.nome_fantasia || cliente.razao_social}
                                                    </h2>
                                                </div>
                                                <p className="text-xs text-slate-400 flex items-start gap-1">
                                                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-500" />
                                                    {cliente.endereco || 'Endereço não informado'}
                                                </p>
                                            </div>
                                            {cliente.telefone && (
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
                                                    onClick={() => handleCall(cliente.telefone)}
                                                >
                                                    <Phone className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
                                                onClick={() => handleOpenMap(cliente)}
                                            >
                                                <ExternalLink className="w-4 h-4 mr-2" /> GPS
                                            </Button>
                                        </div>
                                    </div>

                                    {!isFinalized && (
                                        <div className="grid grid-cols-3 border-t border-white/10 bg-black/40">
                                            <button
                                                onClick={() => handleAction('remarcar', cliente)}
                                                className="py-3 flex flex-col items-center justify-center border-r border-white/5 hover:bg-blue-500/10 transition group"
                                            >
                                                <Clock className="w-5 h-5 text-blue-400 mb-1 group-active:scale-95 transition" />
                                                <span className="text-[10px] text-slate-400 font-bold">REMARCAR</span>
                                            </button>
                                            <button
                                                onClick={() => handleAction('pular', cliente)}
                                                className="py-3 flex flex-col items-center justify-center border-r border-white/5 hover:bg-red-500/10 transition group"
                                            >
                                                <XCircle className="w-5 h-5 text-red-500 mb-1 group-active:scale-95 transition" />
                                                <span className="text-[10px] text-slate-400 font-bold">PULAR</span>
                                            </button>
                                            <button
                                                onClick={() => handleAction('concluir', cliente)}
                                                className="py-3 flex flex-col items-center justify-center bg-emerald-600 hover:bg-emerald-500 transition group"
                                            >
                                                <CheckCircle2 className="w-6 h-6 text-white mb-0.5 group-active:scale-95 transition" />
                                                <span className="text-[10px] text-white font-bold">CONCLUIR</span>
                                            </button>
                                        </div>
                                    )}

                                    {isFinalized && (
                                        <div className="bg-emerald-500/20 py-2 text-center text-[10px] font-bold text-emerald-400">
                                            FINALIZADO
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </div>

            <div className="text-center p-8">
                <p className="text-slate-500 text-xs">Fim do roteiro operacional.</p>
            </div>

            <Dialog open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen}>
                <DialogContent className="bg-slate-900 border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>Reagendar Coleta</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Nova Data Prevista</Label>
                            <Input
                                id="date"
                                type="date"
                                className="bg-black/20 border-white/10 text-white"
                                value={rescheduleDate}
                                onChange={(e) => setRescheduleDate(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400">
                            Ao reagendar, este cliente sairá do roteiro de hoje e aparecerá novamente na agenda na data selecionapa.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setIsRescheduleOpen(false)} className="text-white hover:bg-white/5">
                            Cancelar
                        </Button>
                        <Button onClick={handleReschedule} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default RoteiroOperacionalPage;
