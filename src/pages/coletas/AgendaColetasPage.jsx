import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useLocationData } from '@/hooks/useLocationData';
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
import { Label } from '@/components/ui/label';
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
    const location = useLocation();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(location.state?.searchTerm || '');
    const [viewMode, setViewMode] = useState('list'); // 'map' ou 'list'
    const [filterType, setFilterType] = useState('todos'); // 'todos', 'hoje', 'atrasados', 'proximos'
    const [filterEstado, setFilterEstado] = useState('todos');
    const [filterMunicipio, setFilterMunicipio] = useState('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedClients, setSelectedClients] = useState([]);
    const [municipioMap, setMunicipioMap] = useState({});
    const itemsPerPage = 10;

    // Estados Responsividade
    const [isMobile, setIsMobile] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    const { fetchMunicipiosByCodes } = useLocationData();

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

    // Resolver nomes de municípios
    useEffect(() => {
        const resolveNames = async () => {
            if (clientes.length === 0) return;
            const codesToResolve = [...new Set(clientes.map(c => c.municipio).filter(c => c && !isNaN(c)))];
            if (codesToResolve.length > 0) {
                const mapping = await fetchMunicipiosByCodes(codesToResolve);
                setMunicipioMap(prev => ({ ...prev, ...mapping }));
            }
        };
        resolveNames();
    }, [clientes, fetchMunicipiosByCodes]);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    // Detectar Mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth >= 1024) setShowFilters(true);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Listas únicas de estados e municípios para os filtros
    const estadosDisponiveis = useMemo(() => {
        const states = [...new Set(clientes.map(c => c.estado).filter(Boolean))].sort();
        return states;
    }, [clientes]);

    const municipiosDisponiveis = useMemo(() => {
        let munis = clientes;
        if (filterEstado !== 'todos') {
            munis = munis.filter(c => c.estado === filterEstado);
        }
        const uniqueValues = [...new Set(munis.map(c => c.municipio).filter(Boolean))];
        return uniqueValues.map(val => {
            if (!isNaN(val) && municipioMap[val]) {
                return { value: val, label: municipioMap[val] };
            }
            return { value: val, label: val };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [clientes, filterEstado, municipioMap]);

    // Filtragem de clientes
    const filteredClientes = useMemo(() => {
        const now = new Date();
        return clientes.filter(c => {
            const matchesSearch =
                c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.nome_fantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.endereco?.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            // Filtros Geográficos
            if (filterEstado !== 'todos' && c.estado !== filterEstado) return false;
            if (filterMunicipio !== 'todos' && c.municipio !== filterMunicipio) return false;

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
    }, [clientes, searchTerm, filterType, filterEstado, filterMunicipio]);

    // Paginação
    const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
    const paginatedClientes = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredClientes.slice(start, start + itemsPerPage);
    }, [filteredClientes, currentPage, itemsPerPage]);

    // Resetar página ao mudar filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterType, filterEstado, filterMunicipio]);

    // Inicializar Mapa
    useEffect(() => {
        if (viewMode === 'map' && !mapInitialized && !loading) {
            // Aguardar o DOM renderizar o container do mapa antes de inicializar
            const timer = setTimeout(() => {
                const initMap = () => {
                    if (!window.L) {
                        setTimeout(initMap, 500);
                        return;
                    }
                    const container = document.getElementById('agenda-map');
                    if (!container) {
                        setTimeout(initMap, 100);
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
            }, 50);

            return () => clearTimeout(timer);
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
                <div class="font-bold border-b border-slate-700 pb-2 mb-2">
                    ${cliente.nome_fantasia && cliente.razao_social && cliente.nome_fantasia !== cliente.razao_social
                    ? `${cliente.nome_fantasia} - ${cliente.razao_social}`
                    : (cliente.nome_fantasia || cliente.razao_social)}
                </div>
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

    const sortByNearestNeighbor = (startLat, startLng, clientsToSort) => {
        const haversine = (lat1, lon1, lat2, lon2) => {
            if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return Infinity;
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const isValidCoord = (c) => {
            const lat = parseFloat(c.latitude);
            const lng = parseFloat(c.longitude);
            return !isNaN(lat) && !isNaN(lng) &&
                lat >= -90 && lat <= 90 &&
                lng >= -180 && lng <= 180;
        };

        const withCoords = clientsToSort.filter(isValidCoord);
        const withoutCoords = clientsToSort.filter(c => !isValidCoord(c));

        // Log de diagnóstico para verificar coordenadas
        console.log('📍 Localização atual:', startLat, startLng);
        withCoords.forEach(c => {
            const dist = haversine(startLat, startLng, parseFloat(c.latitude), parseFloat(c.longitude));
            console.log(`  → ${c.nome_fantasia || c.razao_social}: lat=${c.latitude} lng=${c.longitude} | ${dist.toFixed(1)} km`);
        });

        if (withCoords.length === 0) return clientsToSort;

        const sorted = [];
        let remaining = [...withCoords];
        let curLat = startLat;
        let curLng = startLng;

        while (remaining.length > 0) {
            let nearestIdx = 0;
            let nearestDist = Infinity;
            remaining.forEach((c, i) => {
                const d = haversine(curLat, curLng, parseFloat(c.latitude), parseFloat(c.longitude));
                if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
            });
            sorted.push(remaining[nearestIdx]);
            curLat = parseFloat(remaining[nearestIdx].latitude);
            curLng = parseFloat(remaining[nearestIdx].longitude);
            remaining.splice(nearestIdx, 1);
        }

        console.log('🗺️ Ordem final do roteiro:', sorted.map(c => c.nome_fantasia || c.razao_social));
        return [...sorted, ...withoutCoords];
    };

    const handleGenerateRoute = () => {
        if (selectedClients.length === 0) {
            toast({ variant: "destructive", title: "Nenhum cliente selecionado", description: "Selecione ao menos um cliente para gerar o roteiro." });
            return;
        }

        const selectedClientObjects = clientes.filter(c => selectedClients.includes(c.id));

        if (!navigator.geolocation) {
            navigate('/app/roteiro', { state: { clientIds: selectedClients } });
            return;
        }

        toast({ title: "Calculando rota ótima...", description: "Aguardando sua localização para ordenar os clientes." });

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const withCoords = selectedClientObjects.filter(c => c.latitude && c.longitude);
                if (withCoords.length > 1) {
                    const sorted = sortByNearestNeighbor(latitude, longitude, selectedClientObjects);
                    navigate('/app/roteiro', { state: { clientIds: sorted.map(c => c.id) } });
                } else {
                    navigate('/app/roteiro', { state: { clientIds: selectedClients } });
                }
            },
            () => {
                toast({ title: "Localização negada", description: "Gerando roteiro na ordem de seleção." });
                navigate('/app/roteiro', { state: { clientIds: selectedClients } });
            },
            { timeout: 8000 }
        );
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
                        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className={`rounded-lg transition-all ${viewMode === 'list' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <List className="w-4 h-4 mr-2" /> Lista
                    </Button>
                    <Button
                        variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('map')}
                        className={`rounded-lg transition-all ${viewMode === 'map' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <MapIcon className="w-4 h-4 mr-2" /> Mapa
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
                {/* Painel Lateral de Filtros */}
                <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar lg:max-h-screen">
                    <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm overflow-hidden">
                        <CardHeader className="pb-3 md:pt-6">
                            <CardTitle className="text-lg flex items-center justify-between">
                                <div className="flex items-center gap-2 text-emerald-300">
                                    <Filter className="w-5 h-5" /> Filtros
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="lg:hidden flex items-center gap-2 border-white/30 text-white hover:bg-white/10 h-9 rounded-xl"
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <Filter className="w-4 h-4" />
                                    {showFilters ? 'Ocultar' : 'Mostrar'}
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <AnimatePresence>
                            {(showFilters || !isMobile) && (
                                <motion.div
                                    key="filters-content"
                                    initial={isMobile ? { height: 0, opacity: 0 } : false}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={isMobile ? { height: 0, opacity: 0 } : false}
                                    transition={{ duration: 0.3 }}
                                >
                                    <CardContent className="space-y-4 p-4 lg:p-6 pt-0 lg:pt-0">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Buscar cliente..."
                                                className="pl-9 bg-black/20 border-white/10 text-white"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-400">Estado</Label>
                                            <select
                                                className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                value={filterEstado}
                                                onChange={(e) => {
                                                    setFilterEstado(e.target.value);
                                                    setFilterMunicipio('todos');
                                                }}
                                            >
                                                <option value="todos" className="bg-slate-900">Todos ({estadosDisponiveis.length})</option>
                                                {estadosDisponiveis.map(estado => (
                                                    <option key={estado} value={estado} className="bg-slate-900">{estado}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs text-slate-400">Município</Label>
                                            <select
                                                className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                value={filterMunicipio}
                                                onChange={(e) => setFilterMunicipio(e.target.value)}
                                                disabled={filterEstado === 'todos' && municipiosDisponiveis.length > 50}
                                            >
                                                <option value="todos" className="bg-slate-900">Todos ({municipiosDisponiveis.length})</option>
                                                {municipiosDisponiveis.map(muni => (
                                                    <option key={muni.value} value={muni.value} className="bg-slate-900">{muni.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
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
                                </motion.div>
                            )}
                        </AnimatePresence>
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
                                <Navigation className="w-5 h-5 mr-2" /> Gerar Roteiro
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Área Principal (Mapa ou Lista) */}
                <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-white/10 bg-black/20 flex flex-col min-h-[450px] relative">
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
                                className="w-full flex-1 flex flex-col"
                            >
                                {paginatedClientes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                        <Truck className="w-12 h-12 mb-4 opacity-20" />
                                        <p>Nenhum cliente encontrado para estes filtros.</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto custom-scrollbar">
                                        <div className="p-2 lg:p-0">
                                            {/* Cabeçalho de Seleção Mobile */}
                                            {isMobile && paginatedClientes.length > 0 && (
                                                <div className="flex items-center gap-3 mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                    <Checkbox
                                                        id="select-all-mobile"
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
                                                        className="h-5 w-5 border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                                                    />
                                                    <Label htmlFor="select-all-mobile" className="text-white font-semibold cursor-pointer">
                                                        Selecionar Todos nesta página
                                                    </Label>
                                                </div>
                                            )}

                                            <table className="w-full caption-bottom text-sm border-collapse responsive-table">
                                                <TableHeader className="hidden lg:table-header-group bg-white/10 sticky top-0 z-20 backdrop-blur-md">
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
                                                                    <div
                                                                        className="flex items-center justify-center pointer-events-auto"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            toggleClientSelection(cliente.id);
                                                                        }}
                                                                    >
                                                                        <Checkbox
                                                                            checked={isSelected}
                                                                            onCheckedChange={() => { }} // Handle via onClick div
                                                                            className="border-white/20 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 pointer-events-none"
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell data-label="Cliente" className="py-3 font-medium text-white max-w-[250px] truncate">
                                                                    {cliente.nome_fantasia && cliente.razao_social && cliente.nome_fantasia !== cliente.razao_social
                                                                        ? `${cliente.nome_fantasia} - ${cliente.razao_social}`
                                                                        : (cliente.nome_fantasia || cliente.razao_social)}
                                                                </TableCell>
                                                                <TableCell data-label="Localização" className="py-3 text-slate-400 text-xs truncate max-w-[200px]">
                                                                    <div className="truncate">{cliente.endereco || 'Sem endereço'}</div>
                                                                    {(cliente.municipio || cliente.estado) && (
                                                                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                                                            {!isNaN(cliente.municipio) && municipioMap[cliente.municipio]
                                                                                ? municipioMap[cliente.municipio]
                                                                                : cliente.municipio}
                                                                            {cliente.estado ? `, ${cliente.estado}` : ''}
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell data-label="Próxima Coleta" className="py-3 text-slate-300 font-mono text-xs">
                                                                    {proxima ? format(proxima, "dd/MM/yyyy") : '-'}
                                                                </TableCell>
                                                                <TableCell data-label="Status" className="py-3 text-center">
                                                                    {statusBadge}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Controles de Paginação e Total (Apenas na Lista) */}
                    {viewMode === 'list' && filteredClientes.length > 0 && (
                        <div className="p-4 pb-8 sm:pb-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center bg-black/40 gap-4 mt-auto rounded-b-2xl">
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
