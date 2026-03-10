import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2,
    ArrowLeft,
    MapPin,
    LocateFixed,
    PlusCircle,
    UserPlus,
    Navigation,
    Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import { useLocationData } from '@/hooks/useLocationData';

const MapaClientesPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const { fetchMunicipiosByCodes } = useLocationData();

    // Estados de controle
    const [loading, setLoading] = useState(true);
    const [clientes, setClientes] = useState([]);

    // Estados do Mapa
    const mapRef = useRef(null);
    const [userCoords, setUserCoords] = useState(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const markersLayerRef = useRef(null);
    const tempMarkerRef = useRef(null);
    const [municipioMap, setMunicipioMap] = useState({});

    // Buscar clientes para o mapa
    const fetchClientes = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('id, nome_fantasia, razao_social, endereco, latitude, longitude, municipio, estado')
                .not('latitude', 'is', null);

            if (error) throw error;
            setClientes(data || []);
        } catch (error) {
            console.error('MapaClientesPage: Erro ao buscar clientes:', error);
            toast({ variant: "destructive", title: "Erro ao carregar mapa", description: error.message });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

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

    // Inicializar Mapa
    useEffect(() => {
        if (!mapInitialized && clientes.length >= 0) {
            const initMap = () => {
                if (!window.L) {
                    setTimeout(initMap, 500);
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        setUserCoords({ lat: latitude, lng: longitude });
                        setupLeaflet(latitude, longitude);
                    },
                    (error) => {
                        console.warn('MapaClientesPage: Erro ao obter localização:', error.message);
                        setupLeaflet(-15.7801, -47.9292); // Fallback Brasília
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            };

            const setupLeaflet = (lat, lng) => {
                if (mapRef.current) return;
                const L = window.L;

                const map = L.map('map-clientes').setView([lat, lng], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                // Clique no mapa para novo cliente
                map.on('click', (e) => {
                    const { lat, lng } = e.latlng;
                    if (tempMarkerRef.current) {
                        tempMarkerRef.current.setLatLng(e.latlng);
                    } else {
                        const newIcon = L.divIcon({
                            className: 'new-client-marker',
                            html: `<div class="w-8 h-8 bg-emerald-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>`,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        });
                        tempMarkerRef.current = L.marker([lat, lng], { icon: newIcon, draggable: true }).addTo(map);
                    }

                    const isSelectionMode = Boolean(location.state?.returnTo);

                    const popupContent = document.createElement('div');
                    popupContent.className = 'p-3 space-y-3 text-center min-w-[180px] bg-slate-900 text-white rounded-lg border border-white/10 shadow-2xl';
                    popupContent.innerHTML = `
                            <div class="space-y-1">
                                <div class="font-bold text-emerald-400 text-sm">${isSelectionMode ? 'Confirmar Localização?' : 'Novo Cliente Aqui?'}</div>
                                <div class="text-[9px] text-slate-400 font-mono">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                            </div>
                            <button id="btn-confirm-loc" class="w-full bg-emerald-600 text-white text-[11px] py-2.5 px-4 rounded-xl hover:bg-emerald-700 transition-all font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isSelectionMode ? '<polyline points="20 6 9 17 4 12"></polyline>' : '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/>'}</svg>
                                ${isSelectionMode ? 'CONFIRMAR E VOLTAR' : 'CADASTRAR CLIENTE'}
                            </button>
                        `;

                    tempMarkerRef.current.bindPopup(popupContent, {
                        className: 'custom-popup-rjr',
                        closeButton: false
                    }).openPopup();

                    setTimeout(() => {
                        const btn = document.getElementById('btn-confirm-loc');
                        if (btn) {
                            btn.onclick = () => {
                                // Se veio do ClienteForm, retornar com as coordenadas
                                if (isSelectionMode) {
                                    navigate(location.state.returnTo, {
                                        state: {
                                            ...location.state.currentData,
                                            latitude: lat.toString(),
                                            longitude: lng.toString()
                                        }
                                    });
                                } else {
                                    navigate('/app/cadastro/clientes/novo', {
                                        state: { latitude: lat.toString(), longitude: lng.toString() }
                                    });
                                }
                            };
                        }
                    }, 100);
                });

                // Marcador pessoal
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
                    iconSize: [20, 20]
                });
                L.marker([lat, lng], { icon: userIcon }).addTo(map);

                markersLayerRef.current = L.layerGroup().addTo(map);
                mapRef.current = map;
                setMapInitialized(true);
            };

            initMap();
        }
    }, [mapInitialized, clientes, navigate, location.state]);

    // Atualizar marcadores de clientes
    useEffect(() => {
        if (!mapInitialized || !mapRef.current || !markersLayerRef.current) return;

        const L = window.L;
        const layerGroup = markersLayerRef.current;
        layerGroup.clearLayers();

        clientes.forEach(cliente => {
            const cLat = parseFloat(cliente.latitude);
            const cLng = parseFloat(cliente.longitude);

            if (!isNaN(cLat) && !isNaN(cLng)) {
                const clientIcon = L.divIcon({
                    className: 'client-marker',
                    html: `
                        <div class="relative flex flex-col items-center">
                            <div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </div>
                        </div>
                    `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                });

                const marker = L.marker([cLat, cLng], { icon: clientIcon }).addTo(layerGroup);

                const popupDiv = document.createElement('div');
                popupDiv.className = 'p-3 space-y-3 min-w-[200px] bg-slate-900 text-white rounded-lg border border-white/10 shadow-2xl';
                popupDiv.innerHTML = `
                    <div class="space-y-1">
                        <div class="font-bold text-emerald-400 text-sm">
                            ${cliente.nome_fantasia && cliente.razao_social
                                ? `${cliente.nome_fantasia} - ${cliente.razao_social}`
                                : (cliente.nome_fantasia || cliente.razao_social || 'Sem nome')
                            }
                        </div>
                        <div class="text-[10px] text-slate-400 leading-tight">${cliente.endereco || 'Sem endereço registrado'}</div>
                        <div class="text-[10px] text-emerald-400/70 font-medium">
                            ${!isNaN(cliente.municipio) && municipioMap[cliente.municipio] ? municipioMap[cliente.municipio] : (cliente.municipio || '')}
                            ${cliente.estado ? ` - ${cliente.estado}` : ''}
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-2 pt-1">
                        <button id="btn-coleta-${cliente.id}" class="w-full bg-emerald-600/20 text-emerald-400 text-[11px] py-2 px-3 rounded-lg border border-emerald-500/30 flex items-center justify-center gap-2 hover:bg-emerald-600 hover:text-white transition-all font-bold group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
                            Nova Coleta
                        </button>
                        
                        <button id="btn-agenda-${cliente.id}" class="w-full bg-blue-600/20 text-blue-400 text-[11px] py-2 px-3 rounded-lg border border-blue-500/30 flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all font-bold group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Agendar
                        </button>

                        <button id="btn-gps-${cliente.id}" class="w-full bg-slate-800 text-slate-200 text-[11px] py-2 px-3 rounded-lg border border-white/10 flex items-center justify-center gap-2 hover:bg-slate-700 transition-all font-bold group">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-110 transition-transform"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                            Abrir GPS
                        </button>
                    </div>
                `;

                marker.bindPopup(popupDiv, {
                    className: 'custom-popup-rjr',
                    closeButton: false
                });

                marker.on('popupopen', () => {
                    const btnColeta = document.getElementById(`btn-coleta-${cliente.id}`);
                    const btnAgenda = document.getElementById(`btn-agenda-${cliente.id}`);
                    const btnGps = document.getElementById(`btn-gps-${cliente.id}`);

                    if (btnColeta) {
                        btnColeta.onclick = () => navigate('/app/coletas/nova', {
                            state: { preselectClienteId: cliente.id }
                        });
                    }
                    if (btnAgenda) {
                        btnAgenda.onclick = () => navigate('/app/agenda', {
                            state: {
                                preselectClienteId: cliente.id,
                                searchTerm: cliente.nome_fantasia || cliente.razao_social
                            }
                        });
                    }
                    if (btnGps) {
                        btnGps.onclick = () => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${cLat},${cLng}`;
                            window.open(url, '_blank');
                        };
                    }
                });
            }
        });
    }, [mapInitialized, clientes, navigate, municipioMap]);

    return (
        <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
            <Helmet>
                <title>Mapa de Coletas - RJR Óleo</title>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            </Helmet>

            <div className="flex justify-between items-center bg-slate-900/50 backdrop-blur-md p-3 rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-white">Mapa de Coletas</h1>
                        <p className="text-[10px] text-emerald-400">CLIQUE NO MAPA PARA CADASTRAR OU SELECIONAR</p>
                    </div>
                </div>
                <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs h-9"
                    onClick={() => {
                        if (userCoords) {
                            navigate('/app/cadastro/clientes/novo', { state: { latitude: userCoords.lat.toString(), longitude: userCoords.lng.toString() } });
                        } else {
                            navigate('/app/cadastro/clientes/novo');
                        }
                    }}
                >
                    <UserPlus className="w-4 h-4" /> Novo Cliente
                </Button>
            </div>

            <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <div id="map-clientes" className="w-full h-full z-0"></div>

                <Button
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-6 right-6 z-[1000] rounded-full shadow-lg bg-slate-900 border border-white/10 text-white"
                    onClick={() => {
                        if (mapRef.current && userCoords) {
                            mapRef.current.setView([userCoords.lat, userCoords.lng], 16);
                        }
                    }}
                >
                    <LocateFixed className="w-5 h-5" />
                </Button>

                {loading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-[1001] backdrop-blur-sm">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                    </div>
                )}
            </div>

            <style>{`
                .leaflet-container { background: #0f172a !important; }
                .leaflet-popup-content-wrapper { background: #1e293b !important; color: white !important; border-radius: 12px !important; border: 1px solid rgba(255,255,255,0.1) !important; padding: 0 !important; max-width: 250px !important; }
                .leaflet-popup-content { margin: 0 !important; width: 100% !important; }
                .leaflet-popup-tip { background: #1e293b !important; border: 1px solid rgba(255,255,255,0.1) !important; }
                .leaflet-bar { border: none !important; }
                .leaflet-bar a { background-color: #1e293b !important; color: white !important; border: 1px solid rgba(255,255,255,0.1) !important; }
                .leaflet-bar a:hover { background-color: #334155 !important; }
            `}</style>
        </div>
    );
};

export default MapaClientesPage;
