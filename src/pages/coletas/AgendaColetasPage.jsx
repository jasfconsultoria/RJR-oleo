import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2,
    Truck,
    Map as MapIcon,
    List,
    Search,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Navigation,
    PlusCircle,
    ChevronRight,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Checkbox } from "@/components/ui/checkbox";
import { format, isBefore, isToday, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AgendaColetasPage = () => {
    const navigate = useNavigate();
    const { activeCompany } = useAuth();
    const { toast } = useToast();

    // Estados de Dados
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('map'); // 'map' ou 'list'
    const [filterType, setFilterType] = useState('todos'); // 'todos', 'hoje', 'atrasados', 'proximos'
    const [selectedClients, setSelectedClients] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Estados do Mapa
    const mapRef = useRef(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const markersLayerRef = useRef(null);

    // Buscar clientes com dados de inteligência
    const fetchClientes = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('proxima_coleta_prevista', { ascending: true, nullsFirst: false });

            if (error) throw error;
            setClientes(data || []);
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            toast({ variant: "destructive", title: "Erro ao carregar dados", description: error.message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    // Filtragem de clientes
    const filteredClientes = useMemo(() => {
        const now = new Date();
        return clientes.filter(c => {
            const matchesSearch =
                c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.endereco?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            const proxima = c.proxima_coleta_prevista ? parseISO(c.proxima_coleta_prevista) : null;

            if (filterType === 'atrasados') {
                return proxima && isBefore(proxima, now) && !isToday(proxima);
            }
            if (filterType === 'hoje') {
                return proxima && isToday(proxima);
            }
            if (filterType === 'proximos') {
                const limit = addDays(now, 7);
                return proxima && isBefore(proxima, limit) && !isBefore(proxima, now);
            }
            return true;
        });
    }, [clientes, searchTerm, filterType]);

    // Paginação
    const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
    const paginatedClientes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredClientes.slice(start, start + itemsPerPage);
    }, [filteredClientes, currentPage, itemsPerPage]);

    // Resetar página ao mudar filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType]);

    // Inicializar Mapa
    useEffect(() => {
        if (viewMode === 'map' && !mapInitialized && !loading) {
            const initMap = () => {
                if (!window.L) {
                    setTimeout(initMap, 500);
                    return;
                }

                const L = window.L;

                // Centralizar no primeiro cliente com coord ou local padrão
                const firstWithCoords = clientes.find(c => c.latitude && c.longitude);
                const center = firstWithCoords
                    ? [parseFloat(firstWithCoords.latitude), parseFloat(firstWithCoords.longitude)]
                    : [-23.5505, -46.6333]; // SP Fallback

                const map = L.map('agenda-map').setView(center, 12);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                markersLayerRef.current = L.layerGroup().addTo(map);
                mapRef.current = map;
                setMapInitialized(true);
            };

            initMap();
        }
    }, [viewMode, mapInitialized, loading, clientes]);

    // Atualizar marcadores no mapa
    useEffect(() => {
        if (!mapInitialized || !mapRef.current || viewMode !== 'map') return;

        const L = window.L;
        const layerGroup = markersLayerRef.current;
        layerGroup.clearLayers();

        filteredClientes.forEach(cliente => {
            if (!cliente.latitude || !cliente.longitude) return;

            const proxima = cliente.proxima_coleta_prevista ? parseISO(cliente.proxima_coleta_prevista) : null;
            let color = 'bg-slate-400';
            const now = new Date();

            if (proxima) {
                if (isBefore(proxima, now) && !isToday(proxima)) color = 'bg-red-500';
                else if (isToday(proxima)) color = 'bg-yellow-500';
                else if (isBefore(proxima, addDays(now, 3))) color = 'bg-blue-500';
                else color = 'bg-emerald-500';
            }

            const isSelected = selectedClients.includes(cliente.id);

            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div class="relative flex items-center justify-center">
                        <div class="w-8 h-8 ${color} rounded-full border-2 ${isSelected ? 'border-white ring-4 ring-yellow-400' : 'border-white'} shadow-lg flex items-center justify-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });

            const marker = L.marker([parseFloat(cliente.latitude), parseFloat(cliente.longitude)], { icon })
                .addTo(layerGroup);

            const popupContent = document.createElement('div');
            popupContent.className = 'p-3 min-w-[200px] bg-slate-900 text-white rounded-lg';
            popupContent.innerHTML = `
                <div class="font-bold border-b border-slate-700 pb-2 mb-2">${cliente.nome_fantasia || cliente.razao_social}</div>
                <div class="text-xs text-slate-300 mb-1">📅 Previsão: ${cliente.proxima_coleta_prevista ? format(parseISO(cliente.proxima_coleta_prevista), "dd/MM/yyyy") : 'Não definida'}</div>
                <div class="text-xs text-slate-300 mb-3">📍 ${cliente.endereco || 'Sem endereço'}</div>
                <button id="btn-select-${cliente.id}" class="w-full ${isSelected ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-[10px] py-2 rounded transition font-bold">
                    ${isSelected ? 'REMOVER DA ROTA' : 'ADICIONAR À ROTA'}
                </button>
            `;

            marker.bindPopup(popupContent);

            marker.on('popupopen', () => {
                const btn = document.getElementById(`btn-select-${cliente.id}`);
                if (btn) {
                    btn.onclick = () => {
                        toggleClientSelection(cliente.id);
                        marker.closePopup();
                    };
                }
            });
        });
    }, [mapInitialized, filteredClientes, viewMode, selectedClients]);

    const toggleClientSelection = (id) => {
        setSelectedClients(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        const allFilteredIds = filteredClientes.map(c => c.id);
        const allSelected = allFilteredIds.every(id => selectedClients.includes(id));

        if (allSelected) {
            setSelectedClients(prev => prev.filter(id => !allFilteredIds.includes(id)));
        } else {
            setSelectedClients(prev => {
                const newSelection = [...prev];
                allFilteredIds.forEach(id => {
                    if (!newSelection.includes(id)) newSelection.push(id);
                });
                return newSelection;
            });
        }
    };

    const handleGenerateRoute = () => {
        if (selectedClients.length === 0) {
            toast({ variant: "destructive", title: "Nenhum cliente selecionado", description: "Selecione ao menos um cliente para gerar o roteiro." });
            return;
        }
        navigate('/app/coletas/roteiro', { state: { clientIds: selectedClients } });
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
            <Helmet>
                <title>Agenda Operacional - RJR Óleo</title>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            </Helmet>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Calendar className="w-8 h-8 text-emerald-400" /> Agenda Operacional
                    </h1>
                    <p className="text-emerald-100/60 text-sm">Controle inteligente de ciclos de coleta.</p>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl backdrop-blur-md border border-white/10 gap-2">
                    <Button
                        variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('map')}
                        className={`rounded-lg transition-all ${viewMode === 'map' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <MapIcon className="w-4 h-4 mr-2" /> Mapa
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={`rounded-lg transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <List className="w-4 h-4 mr-2" /> Lista
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 overflow-hidden">
                {/* Painel Lateral de Filtros */}
                <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Filter className="w-4 h-4" /> Filtros
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Buscar cliente..."
                                    className="pl-9 bg-black/20 border-white/10 text-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <Button
                                    variant={filterType === 'todos' ? 'secondary' : 'outline'}
                                    className={`justify-start border-white/10 transition-all ${filterType === 'todos' ? 'bg-emerald-600 text-white border-emerald-500' : 'text-slate-300 hover:bg-white/5'}`}
                                    onClick={() => setFilterType('todos')}
                                >
                                    Todos ({clientes.length})
                                </Button>
                                <Button
                                    variant={filterType === 'atrasados' ? 'secondary' : 'outline'}
                                    className={`justify-start border-white/10 transition-all ${filterType === 'atrasados' ? 'bg-red-600 text-white border-red-500' : 'text-red-400 hover:bg-red-500/10'}`}
                                    onClick={() => setFilterType('atrasados')}
                                >
                                    <AlertCircle className="w-4 h-4 mr-2" /> Atrasados
                                </Button>
                                <Button
                                    variant={filterType === 'hoje' ? 'secondary' : 'outline'}
                                    className={`justify-start border-white/10 transition-all ${filterType === 'hoje' ? 'bg-yellow-600 text-white border-yellow-500' : 'text-yellow-400 hover:bg-yellow-500/10'}`}
                                    onClick={() => setFilterType('hoje')}
                                >
                                    <Calendar className="w-4 h-4 mr-2" /> Para Hoje
                                </Button>
                                <Button
                                    variant={filterType === 'proximos' ? 'secondary' : 'outline'}
                                    className={`justify-start border-white/10 transition-all ${filterType === 'proximos' ? 'bg-blue-600 text-white border-blue-500' : 'text-blue-400 hover:bg-blue-500/10'}`}
                                    onClick={() => setFilterType('proximos')}
                                >
                                    <ChevronRight className="w-4 h-4 mr-2" /> Próximos 7 Dias
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium">Selecionados</span>
                                <Badge variant="secondary" className="bg-emerald-500 text-white">{selectedClients.length}</Badge>
                            </div>
                            <Button
                                onClick={handleGenerateRoute}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 rounded-xl shadow-lg"
                                disabled={selectedClients.length === 0}
                            >
                                <Navigation className="w-5 h-5 mr-2" /> GERAR ROTEIRO
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Área Principal (Mapa ou Lista) */}
                <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/10 bg-black/20 flex flex-col">
                    <AnimatePresence mode="wait">
                        {viewMode === 'map' ? (
                            <motion.div
                                key="map-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full h-full relative"
                            >
                                <div id="agenda-map" className="w-full h-full z-10" />
                                {loading && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                                        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="list-view"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="w-full h-full overflow-hidden flex flex-col"
                            >
                                {paginatedClientes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                        <Truck className="w-12 h-12 mb-4 opacity-20" />
                                        <p>Nenhum cliente encontrado para estes filtros.</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full caption-bottom text-sm border-collapse">
                                            <TableHeader className="bg-white/10 sticky top-0 z-20 backdrop-blur-md">
                                                <TableRow className="border-white/10 hover:bg-transparent">
                                                    <TableHead className="w-[50px]">
                                                        <Checkbox
                                                            checked={paginatedClientes.length > 0 && paginatedClientes.every(c => selectedClients.includes(c.id))}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    const ids = paginatedClientes.map(c => c.id);
                                                                    setSelectedClients(prev => [...new Set([...prev, ...ids])]);
                                                                } else {
                                                                    const ids = paginatedClientes.map(c => c.id);
                                                                    setSelectedClients(prev => prev.filter(id => !ids.includes(id)));
                                                                }
                                                            }}
                                                            className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-emerald-400 font-bold">Cliente</TableHead>
                                                    <TableHead className="text-emerald-400 font-bold">Localização</TableHead>
                                                    <TableHead className="text-emerald-400 font-bold">Próxima Coleta</TableHead>
                                                    <TableHead className="text-emerald-400 font-bold text-center">Status</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedClientes.map(cliente => {
                                                    const isSelected = selectedClients.includes(cliente.id);
                                                    const proxima = cliente.proxima_coleta_prevista ? parseISO(cliente.proxima_coleta_prevista) : null;

                                                    let statusBadge = <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10">NORMAL</Badge>;
                                                    if (proxima) {
                                                        if (isBefore(proxima, new Date()) && !isToday(proxima)) {
                                                            statusBadge = <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">ATRASADO</Badge>;
                                                        } else if (isToday(proxima)) {
                                                            statusBadge = <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30">HOJE</Badge>;
                                                        } else if (isBefore(proxima, addDays(new Date(), 3))) {
                                                            statusBadge = <Badge className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30">ALERTA</Badge>;
                                                        }
                                                    }

                                                    return (
                                                        <TableRow
                                                            key={cliente.id}
                                                            className={`border-white/5 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-500/10 hover:bg-emerald-500/20' : 'hover:bg-white/5'}`}
                                                            onClick={(e) => {
                                                                // Prevenir trigger duplo ao clicar no checkbox diretamente
                                                                if (e.target.type !== 'checkbox') {
                                                                    toggleClientSelection(cliente.id);
                                                                }
                                                            }}
                                                        >
                                                            <TableCell className="py-3">
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={() => toggleClientSelection(cliente.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="py-3 font-medium text-white max-w-[250px] truncate">
                                                                {cliente.nome_fantasia || cliente.razao_social}
                                                            </TableCell>
                                                            <TableCell className="py-3 text-slate-400 text-xs truncate max-w-[200px]">
                                                                {cliente.endereco || 'Sem endereço'}
                                                            </TableCell>
                                                            <TableCell className="py-3 text-slate-300 font-mono text-xs">
                                                                {proxima ? format(proxima, "dd/MM/yyyy") : '-'}
                                                            </TableCell>
                                                            <TableCell className="py-3 text-center">
                                                                {statusBadge}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </table>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Controles de Paginação e Total (Apenas na Lista) */}
                    {viewMode === 'list' && filteredClientes.length > 0 && (
                        <div className="p-4 border-t border-white/10 flex justify-between items-center bg-black/40 mt-auto">
                            <p className="text-xs text-slate-400">
                                Mostrando {Math.min(filteredClientes.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredClientes.length, currentPage * itemsPerPage)} de {filteredClientes.length}
                            </p>
                            {totalPages > 1 && (
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="border-white/10 text-white"
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="border-white/10 text-white"
                                    >
                                        Próximo
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .leaflet-container { background: #0f172a !important; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
                .leaflet-popup-content-wrapper { background: #0f172a !important; color: white !important; border-radius: 12px !important; border: 1px solid rgba(255,255,255,0.2) !important; padding: 0 !important; }
                .leaflet-popup-content { margin: 0 !important; width: auto !important; }
                .leaflet-popup-tip { background: #0f172a !important; border: 1px solid rgba(255,255,255,0.2) !important; }
                .leaflet-bar { border: none !important; }
                .leaflet-bar a { background-color: #1e293b !important; color: white !important; border: 1px solid rgba(255,255,255,0.1) !important; }
                .leaflet-bar a:hover { background-color: #334155 !important; }
            `}</style>
        </div >
    );
};

export default AgendaColetasPage;
