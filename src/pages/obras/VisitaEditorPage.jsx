"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import {
    Loader2,
    Save,
    ArrowLeft,
    Calendar,
    MapPin,
    ClipboardList,
    CheckCircle2,
    History,
    ExternalLink,
    Construction,
    Navigation,
    LocateFixed,
    PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import ObraForm from './components/ObraForm';
import { logAction } from '@/lib/log';
import { format } from 'date-fns';

const VisitaEditorPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser, activeCompany } = useAuth();
    const { toast } = useToast();

    // Obter obraId da URL para centralização inicial
    const searchParams = new URLSearchParams(location.search);
    const initialObraId = searchParams.get('obraId');

    // Estados de controle
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState(id || initialObraId ? 'form' : 'map');
    const [obras, setObras] = useState([]);

    // Estados do Mapa
    const mapRef = useRef(null);
    const [userCoords, setUserCoords] = useState(null);
    const [mapInitialized, setMapInitialized] = useState(false);
    const markersLayerRef = useRef(null);
    const tempMarkerRef = useRef(null);

    const [formData, setFormData] = useState({
        obra_id: '',
        data_visita: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        status: 1, // 1: Aguardando
        status_obra: 1, // 1: Em andamento
        observacoes: '',
        latitude: '',
        longitude: ''
    });

    // Estado do Modal de Obra
    const [isObraModalOpen, setIsObraModalOpen] = useState(false);
    const [modalCoords, setModalCoords] = useState(null);

    // Buscar obras para o mapa
    const fetchObras = useCallback(async () => {
        console.log('VisitaEditorPage: Iniciando fetchObras...');
        if (!activeCompany?.cnpj) {
            console.warn('VisitaEditorPage: activeCompany.cnpj não encontrado.');
            return;
        }
        try {
            const cnpjLimpo = activeCompany.cnpj.replace(/\D/g, '');
            const currentUrl = supabase.supabaseUrl;
            console.log(`VisitaEditorPage: Consultando 'obras' no ambiente ${currentUrl} para empresa ${cnpjLimpo}...`);

            const fetchPromise = supabase
                .from('obras')
                .select('id, obra, endereco, latitude, longitude')
                .eq('empresa', cnpjLimpo)
                .order('obra');

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_OBRAS_FETCH')), 15000)
            );

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) {
                console.error('VisitaEditorPage: Erro na consulta de obras:', error);
                throw error;
            }
            console.log(`VisitaEditorPage: ${data?.length || 0} obras encontradas para o mapa.`);
            setObras(data || []);
        } catch (error) {
            console.error('VisitaEditorPage: Erro fatal no fetchObras:', error);
        }
    }, [activeCompany]);

    const fetchVisita = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('obras_visitas')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (data) {
                setFormData({
                    ...data,
                    obra_id: data.obra_id.toString(),
                    data_visita: format(new Date(data.data_visita), "yyyy-MM-dd'T'HH:mm")
                });
                setViewMode('form');
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao carregar visita", description: error.message });
        } finally {
            setLoading(false);
        }
    }, [id, toast]);

    useEffect(() => {
        fetchObras();
        fetchVisita();
    }, [fetchObras, fetchVisita]);

    // Inicializar Mapa (Leaflet via window.L)
    useEffect(() => {
        if (viewMode === 'map' && !mapInitialized && obras.length >= 0) {
            const initMap = () => {
                if (!window.L) {
                    setTimeout(initMap, 500); // Aguarda o script carregar se necessário
                    return;
                }

                // Tenta pegar localização GPS com opções de alta precisão
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        console.log(`VisitaEditorPage: Localização obtida com sucesso: ${latitude}, ${longitude}`);
                        setUserCoords({ lat: latitude, lng: longitude });
                        setupLeaflet(latitude, longitude);
                    },
                    (error) => {
                        console.warn('VisitaEditorPage: Erro ao obter localização:', error.message);
                        // Fallback: Centro do Brasil ou coordenada padrão
                        setupLeaflet(-15.7801, -47.9292);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0
                    }
                );
            };

            const setupLeaflet = (lat, lng) => {
                if (mapRef.current) return;

                const L = window.L;

                // Verificar se há uma obra selecionada para centralizar
                let centerLat = lat;
                let centerLng = lng;
                let initialZoom = 18;

                if (initialObraId) {
                    const targetObra = obras.find(o => o.id.toString() === initialObraId);
                    if (targetObra && targetObra.latitude && targetObra.longitude) {
                        centerLat = parseFloat(targetObra.latitude);
                        centerLng = parseFloat(targetObra.longitude);
                        initialZoom = 19; // Zoom mais próximo se for uma obra específica
                    }
                }

                const map = L.map('map-container').setView([centerLat, centerLng], initialZoom);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                // Ícones customizados usando SVG e Tailwind
                const getObraIcon = () => {
                    return L.divIcon({
                        className: 'custom-obra-marker',
                        html: `
                            <div class="relative flex items-center justify-center">
                                <div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                                </div>
                                <div class="absolute -bottom-1 w-2 h-2 bg-blue-600 rotate-45 border-r border-b border-white"></div>
                            </div>
                        `,
                        iconSize: [32, 40],
                        iconAnchor: [16, 40],
                        popupAnchor: [0, -35]
                    });
                };

                const companyIcon = getObraIcon();

                // Evento de clique no mapa para criar novo marcador
                map.on('click', (e) => {
                    const { lat, lng } = e.latlng;

                    if (tempMarkerRef.current) {
                        tempMarkerRef.current.setLatLng(e.latlng);
                    } else {
                        const newIcon = L.divIcon({
                            className: 'new-location-marker',
                            html: `<div class="w-8 h-8 bg-emerald-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>`,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        });
                        tempMarkerRef.current = L.marker([lat, lng], { icon: newIcon, draggable: true }).addTo(map);
                    }

                    const popupContent = document.createElement('div');
                    popupContent.className = 'p-2 space-y-2 text-center';
                    popupContent.innerHTML = `
                            <div class="font-bold text-emerald-800">Nova Obra Aqui?</div>
                            <div class="text-[10px] text-slate-500 mb-2">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
                            <button id="btn-new-obra" class="w-full bg-emerald-600 text-white text-xs py-2 px-3 rounded hover:bg-emerald-700 transition font-semibold flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                                Cadastrar Obra
                            </button>
                        `;

                    tempMarkerRef.current.bindPopup(popupContent).openPopup();

                    // Listener para o botão de cadastro
                    setTimeout(() => {
                        const btn = document.getElementById('btn-new-obra');
                        if (btn) {
                            btn.onclick = () => {
                                setModalCoords({ lat, lng });
                                setIsObraModalOpen(true);
                            };
                        }
                    }, 100);
                });

                // Marcador da posição atual do usuário
                const userIcon = L.divIcon({
                    className: 'user-location-marker',
                    html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
                    iconSize: [20, 20]
                });
                L.marker([lat, lng], { icon: userIcon }).addTo(map).bindPopup("Você está aqui");

                // Camada de marcadores para obras
                markersLayerRef.current = L.layerGroup().addTo(map);

                mapRef.current = map;
                setMapInitialized(true);
            };

            initMap();
        }
    }, [viewMode, mapInitialized, obras, activeCompany]);

    // Adicionar/Atualizar obras ao mapa de forma independente (TOP LEVEL)
    useEffect(() => {
        if (!mapInitialized || !mapRef.current || !markersLayerRef.current || viewMode !== 'map') return;

        const L = window.L;
        const map = mapRef.current;
        const layerGroup = markersLayerRef.current;

        console.log(`VisitaEditorPage: Atualizando ${obras.length} marcadores no mapa.`);

        // Limpar marcadores existentes
        layerGroup.clearLayers();

        const getObraIcon = (obraNome) => {
            return L.divIcon({
                className: 'custom-obra-marker',
                html: `
                    <div class="relative flex flex-col items-center">
                        <div class="whitespace-nowrap bg-white/90 dark:bg-slate-800/90 px-2 py-0.5 rounded shadow-sm border border-blue-200 dark:border-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300 mb-1 animate-in fade-in zoom-in duration-300">
                            ${obraNome}
                        </div>
                        <div class="relative flex items-center justify-center">
                            <div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transition-transform hover:scale-110">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                            </div>
                            <div class="absolute -bottom-1 w-2 h-2 bg-blue-600 rotate-45 border-r border-b border-white"></div>
                        </div>
                    </div>
                `,
                iconSize: [120, 60],
                iconAnchor: [60, 60],
                popupAnchor: [0, -55]
            });
        };

        // Adicionar cada obra como um marcador
        obras.forEach(obra => {
            const oLat = parseFloat(obra.latitude);
            const oLng = parseFloat(obra.longitude);

            if (!isNaN(oLat) && !isNaN(oLng)) {
                const companyIcon = getObraIcon(obra.obra);
                const marker = L.marker([oLat, oLng], { icon: companyIcon }).addTo(layerGroup);

                const popupContent = document.createElement('div');
                popupContent.className = 'p-2 space-y-2 min-w-[180px]';
                popupContent.innerHTML = `
                        <div class="font-bold text-blue-800 dark:text-blue-300 border-b pb-1 mb-1">${obra.obra}</div>
                        <div class="text-[11px] text-slate-600 dark:text-slate-400 mb-2 leading-tight">${obra.endereco || 'Sem endereço cadastrado'}</div>
                        <div class="grid grid-cols-1 gap-2">
                            <button id="btn-visita-${obra.id}" class="w-full bg-blue-600 text-white text-[11px] py-1.5 px-3 rounded hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
                                Registrar Visita
                            </button>
                            <button id="btn-gps-${obra.id}" class="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] py-1.5 px-3 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition font-semibold flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-600 shadow-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 10-4 4-4-4"/></svg>
                                Abrir no GPS
                            </button>
                        </div>
                    `;

                marker.bindPopup(popupContent, {
                    maxWidth: 250,
                    className: 'custom-popup'
                });

                // Abrir popup automaticamente se for a obra selecionada no início
                if (initialObraId && obra.id.toString() === initialObraId) {
                    setTimeout(() => marker.openPopup(), 1000);
                }

                // Event Listeners para os botões do popup
                marker.on('popupopen', () => {
                    const btnVisita = document.getElementById(`btn-visita-${obra.id}`);
                    if (btnVisita) {
                        btnVisita.onclick = (e) => {
                            e.preventDefault();
                            handleSelectObraFromMap(obra);
                        };
                    }

                    const btnGps = document.getElementById(`btn-gps-${obra.id}`);
                    if (btnGps) {
                        btnGps.onclick = (e) => {
                            e.preventDefault();
                            window.open(`https://www.google.com/maps?q=${oLat},${oLng}`, '_blank');
                        };
                    }
                });
            }
        });
    }, [mapInitialized, obras, initialObraId, viewMode]);

    const handleSelectObraFromMap = (obra) => {
        setFormData(prev => ({
            ...prev,
            obra_id: obra.id.toString(),
            latitude: userCoords?.lat?.toString() || '',
            longitude: userCoords?.lng?.toString() || ''
        }));
        setViewMode('form');
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.obra_id) {
            toast({ variant: "destructive", title: "Campo Obrigatório", description: "Selecione uma obra." });
            return;
        }

        setSaving(true);
        try {
            const cnpjLimpo = activeCompany.cnpj.replace(/\D/g, '');
            const payload = {
                ...formData,
                obra_id: parseInt(formData.obra_id),
                empresa: cnpjLimpo,
                usuario_id: currentUser.id,
                data_visita: formData.data_visita ? new Date(formData.data_visita) : null,
                updated_at: new Date()
            };

            let error;
            if (id) {
                const { error: err } = await supabase
                    .from('obras_visitas')
                    .update(payload)
                    .eq('id', id);
                error = err;
            } else {
                const { error: err } = await supabase
                    .from('obras_visitas')
                    .insert([payload]);
                error = err;
            }

            if (error) throw error;

            const dataFormatada = format(new Date(formData.data_visita), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
            toast({ title: "Sucesso!", description: id ? `Visita atualizada para ${dataFormatada}.` : `Visita registrada para ${dataFormatada}.` });
            await logAction(currentUser.id, id ? 'visita_update' : 'visita_create', `Visita para obra ID ${formData.obra_id}`, null, id);
            navigate('/app/obras/visitas');
        } catch (error) {
            toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
        } finally {
            setSaving(false);
        }
    };

    const handleGoogleCalendar = () => {
        const obra = obras.find(o => o.id.toString() === formData.obra_id);
        const start = new Date(formData.data_visita);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hora

        const formatCalendarDate = (date) => date.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const title = `Visita Obra: ${obra?.obra || 'Construção'}`;
        const details = `Observações: ${formData.observacoes}`;
        const location = obra?.endereco || '';
        const dates = `${formatCalendarDate(start)}/${formatCalendarDate(end)}`;

        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}&dates=${dates}`;

        window.open(url, '_blank');
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;

    // RENDER: Mapa
    if (viewMode === 'map') {
        return (
            <div className="h-[calc(100vh-100px)] flex flex-col space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate('/app/obras/visitas')}>
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Selecione a Obra no Mapa</h1>
                            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">Toque no ícone da empresa para registrar visita ou navegação.</p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button
                            variant="default"
                            className="save-button w-full sm:w-auto"
                            onClick={() => {
                                if (userCoords) {
                                    setModalCoords({ lat: userCoords.lat, lng: userCoords.lng });
                                } else {
                                    setModalCoords(null);
                                }
                                setIsObraModalOpen(true);
                            }}
                        >
                            <PlusCircle className="w-5 h-5 mr-2" />
                            Cadastrar Nova Obra
                        </Button>
                        <Button variant="outline" onClick={() => setViewMode('form')} className="gap-2 text-blue-600 border-blue-200 w-full sm:w-auto">
                            Ignorar Mapa <ArrowLeft className="w-4 h-4 rotate-180" />
                        </Button>
                    </div>
                </div>

                <div className="relative flex-1 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-xl">
                    <div id="map-container" className="w-full h-full z-0"></div>

                    {/* Botão flutuante para minha localização */}
                    <Button
                        variant="secondary"
                        size="icon"
                        className="absolute bottom-6 right-6 z-[1000] rounded-full shadow-lg bg-white hover:bg-slate-50 border border-slate-200"
                        onClick={() => {
                            if (mapRef.current && userCoords) {
                                mapRef.current.setView([userCoords.lat, userCoords.lng], 18);
                            }
                        }}
                        title="Minha Localização"
                    >
                        <LocateFixed className="w-5 h-5 text-blue-600" />
                    </Button>

                    {!mapInitialized && (
                        <div className="absolute inset-0 bg-slate-50/80 flex items-center justify-center z-[1001]">
                            <div className="text-center space-y-2">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                                <p className="text-sm font-medium text-slate-600">Obtendo localização...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Botões de Ação ABAIXO do Mapa */}


                {/* Modal de Cadastro de Obra */}
                <Dialog open={isObraModalOpen} onOpenChange={setIsObraModalOpen}>
                    <DialogContent className="max-w-4xl p-0 border-none bg-slate-50 dark:bg-slate-950">
                        <DialogHeader className="p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800">
                            <DialogTitle className="text-2xl font-bold gradient-text flex items-center gap-2">
                                <Construction className="w-6 h-6 text-blue-600" />
                                Cadastrar Nova Obra
                            </DialogTitle>
                        </DialogHeader>
                        <div className="p-6 bg-white dark:bg-slate-900">
                            <ObraForm
                                initialCoords={modalCoords}
                                onCancel={() => setIsObraModalOpen(false)}
                                onSaveSuccess={async (newObra) => {
                                    setIsObraModalOpen(false);

                                    // Remover o marcador temporário de "adicionar obra"
                                    if (tempMarkerRef.current) {
                                        tempMarkerRef.current.remove();
                                        tempMarkerRef.current = null;
                                    }

                                    fetchObras(); // Atualiza lista de obras no mapa

                                    if (newObra) {
                                        toast({ title: "Sucesso", description: `Obra ${newObra.obra} cadastrada! Agendando visita para amanhã...` });

                                        try {
                                            // Data da visita: daqui a exatamente 24 horas (now + 1 dia)
                                            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

                                            const cnpjLimpo = activeCompany.cnpj.replace(/\D/g, '');
                                            const visitPayload = {
                                                obra_id: newObra.id,
                                                empresa: cnpjLimpo,
                                                usuario_id: currentUser.id,
                                                data_visita: tomorrow,
                                                status: 1, // 1: Aguardando
                                                status_obra: 1, // 1: Em andamento
                                                observacoes: 'Visita agendada automaticamente após cadastro da obra.',
                                                updated_at: new Date()
                                            };

                                            const { error: visitError } = await supabase
                                                .from('obras_visitas')
                                                .insert([visitPayload]);

                                            if (visitError) throw visitError;

                                            toast({ title: "Visita Agendada", description: "Uma visita automática foi agendada para amanhã às 09:00." });
                                        } catch (error) {
                                            console.error("Erro ao agendar visita automática:", error);
                                            toast({ variant: "destructive", title: "Erro na Visita", description: "A obra foi salva, mas ocorreu um erro ao agendar a visita automática." });
                                        }
                                    }
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    // RENDER: Formulário
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => id ? navigate('/app/obras/visitas') : setViewMode('map')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">{id ? 'Editar Visita' : 'Registrar Visita'}</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">Histórico e agendamento de visitas científicas às obras.</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-xl shadow-sm border border-slate-100 dark:bg-slate-800 dark:border-slate-700">

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><Construction className="w-4 h-4 text-blue-500" /> Obra Selecionada</Label>
                            <Select
                                value={formData.obra_id}
                                onValueChange={(val) => setFormData({ ...formData, obra_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a obra..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {obras.map(o => (
                                        <SelectItem key={o.id} value={o.id.toString()}>{o.obra}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" /> Data e Hora</Label>
                                <Input
                                    type="datetime-local"
                                    value={formData.data_visita}
                                    onChange={(e) => setFormData({ ...formData, data_visita: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Status da Visita</Label>
                                <Select
                                    value={formData.status.toString()}
                                    onValueChange={(val) => setFormData({ ...formData, status: parseInt(val) })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">Aguardando</SelectItem>
                                        <SelectItem value="2">Concluída</SelectItem>
                                        <SelectItem value="3">Remarcada</SelectItem>
                                        <SelectItem value="4">Cancelada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {formData.latitude && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <Navigation className="w-3 h-3 text-blue-500" /> GPS Capturado: {parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)}
                                </span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank');
                                    }}
                                >
                                    Abrir GPS
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><History className="w-4 h-4 text-blue-500" /> Status da Obra (na visita)</Label>
                            <Select
                                value={formData.status_obra.toString()}
                                onValueChange={(val) => setFormData({ ...formData, status_obra: parseInt(val) })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">Em andamento</SelectItem>
                                    <SelectItem value="2">Concluída</SelectItem>
                                    <SelectItem value="3">Paralisada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-blue-500" /> Observações / Diário de Obra</Label>
                            <Textarea
                                placeholder="Relate o que foi visto na visita..."
                                className="h-28"
                                value={formData.observacoes}
                                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-end">
                    <Button type="button" variant="outline" className="flex-1 sm:flex-none sm:w-64 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 order-2 sm:order-1" onClick={handleGoogleCalendar}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Sincronizar com Agenda
                    </Button>

                    <Button type="submit" className="flex-1 sm:flex-none sm:w-64 save-button order-1 sm:order-2" disabled={saving}>
                        {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        {id ? 'Salvar Alterações' : 'Salvar Registro de Visita'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default VisitaEditorPage;

