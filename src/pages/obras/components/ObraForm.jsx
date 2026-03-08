import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Save, Loader2, Building, Search, CalendarCheck, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { logAction } from '@/lib/log';
import { IMaskInput } from 'react-imask';
import SelectSearchMunicipality from '@/components/municipios/SelectSearchMunicipality';
import SelectSearchClient from '@/components/pessoas/SelectSearchClient';
import { Checkbox } from '@/components/ui/checkbox';
import VisitasSubList from '../VisitasSubList';

const initialObraState = {
    empresa: '',
    codigo: '',
    obra: '',
    municipio: '',
    endereco: '',
    cep: '',
    contrato: '',
    contratante: '',
    contato: '',
    telefone: '',
    edificacao: 0,
    obra_viaria: 0,
    oae: 0,
    linear: 0,
    localizada: 0,
    status: 1, // 1: Em andamento, 2: Concluída, 3: Paralisada
    observacao: '',
    data_cad: new Date().toISOString(),
    cliente: '',
    responsavel: '',
    tel_responsavel: '',
    inicio: '',
    fim: '',
    valor_inicial: 0,
    arquivos: '',
    m2: 0,
    licenciado: '',
    latitude: '',
    longitude: '',
    estado: ''
};

// Fallback estático de UFs para casos de falha na rede
const UF_FALLBACK = [
    { uf: 1, sigla: 'AC', estado: 'Acre' }, { uf: 2, sigla: 'AL', estado: 'Alagoas' },
    { uf: 3, sigla: 'AP', estado: 'Amapá' }, { uf: 4, sigla: 'AM', estado: 'Amazonas' },
    { uf: 5, sigla: 'BA', estado: 'Bahia' }, { uf: 6, sigla: 'CE', estado: 'Ceará' },
    { uf: 7, sigla: 'DF', estado: 'Distrito Federal' }, { uf: 8, sigla: 'ES', estado: 'Espírito Santo' },
    { uf: 9, sigla: 'GO', estado: 'Goiás' }, { uf: 10, sigla: 'MA', estado: 'Maranhão' },
    { uf: 11, sigla: 'MT', estado: 'Mato Grosso' }, { uf: 12, sigla: 'MS', estado: 'Mato Grosso do Sul' },
    { uf: 13, sigla: 'MG', estado: 'Minas Gerais' }, { uf: 14, sigla: 'PA', estado: 'Pará' },
    { uf: 15, sigla: 'PB', estado: 'Paraíba' }, { uf: 16, sigla: 'PR', estado: 'Paraná' },
    { uf: 17, sigla: 'PE', estado: 'Pernambuco' }, { uf: 18, sigla: 'PI', estado: 'Piauí' },
    { uf: 19, sigla: 'RJ', estado: 'Rio de Janeiro' }, { uf: 20, sigla: 'RN', estado: 'Rio Grande do Norte' },
    { uf: 21, sigla: 'RS', estado: 'Rio Grande do Sul' }, { uf: 22, sigla: 'RO', estado: 'Rondônia' },
    { uf: 23, sigla: 'RR', estado: 'Roraima' }, { uf: 24, sigla: 'SC', estado: 'Santa Catarina' },
    { uf: 25, sigla: 'SP', estado: 'São Paulo' }, { uf: 26, sigla: 'SE', estado: 'Sergipe' },
    { uf: 27, sigla: 'TO', estado: 'Tocantins' }
];

const ObraForm = ({ id, initialCoords, onSaveSuccess, onCancel }) => {
    const { user, activeCompany } = useAuth();
    const { toast } = useToast();
    const [obra, setObra] = useState(initialObraState);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [ufs, setUfs] = useState([]);
    const [selectedUfSigla, setSelectedUfSigla] = useState('');
    const [selectedUfIdForMunicipalities, setSelectedUfIdForMunicipalities] = useState(null);
    const [municipalities, setMunicipalities] = useState([]);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);

    const generateNextObraCode = useCallback(async (companyCnpj) => {
        try {
            const cleanCnpj = companyCnpj.replace(/\D/g, '');
            const { data, error } = await supabase
                .from('obras')
                .select('codigo')
                .eq('empresa', cleanCnpj);

            if (error) throw error;
            if (!data || data.length === 0) return '00001';

            let maxCode = 0;
            data.forEach(item => {
                if (item.codigo) {
                    const numericPart = String(item.codigo).replace(/\D/g, '');
                    if (numericPart) {
                        const numValue = parseInt(numericPart, 10);
                        if (!isNaN(numValue) && numValue > maxCode) {
                            maxCode = numValue;
                        }
                    }
                }
            });

            const nextCode = maxCode + 1;
            return nextCode.toString().padStart(5, '0');
        } catch (error) {
            console.error('Erro ao gerar próximo código de obra:', error);
            return '00001';
        }
    }, []);

    const formatObraCode = (code) => {
        if (!code) return '';
        const numericPart = String(code).replace(/\D/g, '');
        if (!numericPart) return '';
        const numValue = parseInt(numericPart, 10);
        if (isNaN(numValue)) return '';
        return numValue.toString().padStart(5, '0');
    };

    const fetchUfs = useCallback(async () => {
        try {
            const currentUrl = supabase.supabaseUrl || 'URL não identificada';
            console.log("ObraForm: Diagnóstico de Rede - Supabase URL:", currentUrl);
            console.log("ObraForm: Buscando UFs...");

            // Timeout de 15 segundos (aumentado para garantir resiliência total)
            const fetchPromise = supabase.from('estados').select('uf, sigla, estado').order('sigla');
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_UF')), 15000));

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

            if (error) throw error;
            if (data && data.length > 0) {
                setUfs(data);
                console.log("ObraForm: UFs carregadas do banco.");
            } else {
                console.warn("ObraForm: Tabela de estados retornou vazia. Usando fallback.");
                setUfs(UF_FALLBACK);
            }
        } catch (error) {
            console.error("ObraForm: Falha ao carregar UFs:", error.message);
            if (error.message === 'TIMEOUT_UF' || error.message?.includes('fetch')) {
                console.warn("ObraForm: Usando fallback estático de UFs devido a falha de rede/timeout.");
                setUfs(UF_FALLBACK);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchMunicipalities = useCallback(async (ufId) => {
        if (!ufId) {
            setMunicipalities([]);
            return;
        }
        try {
            // Timeout de 15 segundos
            const fetchPromise = supabase.from('municipios').select('codigo, municipio').eq('uf', ufId).order('municipio');
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_MUNI')), 15000));

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
            if (error) throw error;
            setMunicipalities(data || []);
        } catch (error) {
            console.error("ObraForm: Erro ao buscar municípios:", error.message);
            toast({ variant: 'destructive', title: 'Erro de Conexão', description: 'Não foi possível carregar a lista de municípios. Tente novamente.' });
        }
    }, [toast]);

    useEffect(() => {
        fetchUfs();

        // Medida de segurança: se após 5 segundos ainda estiver carregando, libera
        const timer = setTimeout(() => {
            setLoading(prev => {
                if (prev) {
                    console.warn("ObraForm: Timeout de carregamento atingido. Liberando formulário via fallback.");
                    return false;
                }
                return false;
            });
        }, 5000);

        return () => clearTimeout(timer);
    }, [fetchUfs]);

    const fetchObra = useCallback(async () => {
        console.log("ObraForm: Iniciando fetchObra. ID:", id);

        if (!id) {
            try {
                const initialData = {
                    ...initialObraState,
                    data_cad: new Date().toISOString()
                };

                if (activeCompany?.cnpj) {
                    console.log("ObraForm: Gerando código para empresa:", activeCompany.cnpj);
                    initialData.empresa = activeCompany.cnpj.replace(/\D/g, '');
                    const nextCode = await generateNextObraCode(activeCompany.cnpj);
                    initialData.codigo = nextCode;
                }

                if (initialCoords?.lat) initialData.latitude = initialCoords.lat.toString();
                if (initialCoords?.lng) initialData.longitude = initialCoords.lng.toString();

                setObra(initialData);
                console.log("ObraForm: Inicialização de nova obra concluída.");
            } catch (err) {
                console.error("ObraForm: Erro na inicialização de nova obra:", err);
            } finally {
                setLoading(false);
            }
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('obras')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;
            if (data) {
                // ✅ OTIMIZAÇÃO: Não precisamos mais buscar UF via município 
                // porque agora temos a coluna 'estado' direta na tabela obras
                if (data.estado) {
                    setSelectedUfSigla(data.estado);
                    const ufObj = ufs.find(u => u.sigla === data.estado);
                    if (ufObj) setSelectedUfIdForMunicipalities(ufObj.uf);
                } else if (data.municipio) {
                    // Fallback para obras antigas que não tem a coluna 'estado' preenchida
                    const { data: municipioData } = await supabase
                        .from('municipios')
                        .select('uf')
                        .eq('codigo', data.municipio)
                        .single();

                    if (municipioData) {
                        const { data: ufData } = await supabase
                            .from('estados')
                            .select('sigla')
                            .eq('uf', municipioData.uf)
                            .single();

                        if (ufData) {
                            setSelectedUfSigla(ufData.sigla);
                            setSelectedUfIdForMunicipalities(municipioData.uf);
                        }
                    }
                }

                if (data.contratante) {
                    // ✅ OTIMIZAÇÃO: Usar maybeSingle() ou limitar a 1 para evitar erro 406/PGRST116 se houver duplicidade
                    const { data: clientRows, error: clientError } = await supabase
                        .from('pessoas')
                        .select('*')
                        .eq('cpf_cnpj', data.contratante)
                        .limit(1);

                    if (!clientError && clientRows && clientRows.length > 0) {
                        setSelectedClient(clientRows[0]);
                    }
                }

                setObra({
                    ...data,
                    codigo: formatObraCode(data.codigo),
                    estado: data.estado || ''
                });

                if (data.estado) {
                    setSelectedUfSigla(data.estado);
                    const ufObj = ufs.find(u => u.sigla === data.estado);
                    if (ufObj) setSelectedUfIdForMunicipalities(ufObj.uf);
                }
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro ao carregar obra', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [id, activeCompany, initialCoords, generateNextObraCode, toast]);

    useEffect(() => {
        if (ufs.length > 0 || !id) {
            fetchObra();
        }
    }, [fetchObra, ufs, id]);

    useEffect(() => {
        if (selectedUfIdForMunicipalities) {
            fetchMunicipalities(selectedUfIdForMunicipalities);
        } else {
            setMunicipalities([]);
        }
    }, [selectedUfIdForMunicipalities, fetchMunicipalities]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setObra(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (fieldId, value) => {
        if (fieldId === 'uf') {
            setSelectedUfSigla(value);
            const uf = ufs.find(u => u.sigla === value);
            if (uf) setSelectedUfIdForMunicipalities(uf.uf);
        } else {
            setObra(prev => ({ ...prev, [fieldId]: value }));
        }
    };

    const handleCheckboxChange = (fieldId, checked) => {
        setObra(prev => ({ ...prev, [fieldId]: checked ? 1 : 0 }));
    };

    const buscarCep = async () => {
        if (!obra.cep) return;
        const cepLimpo = obra.cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        setBuscandoCep(true);
        console.log("ObraForm: Iniciando busca de CEP:", cepLimpo);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await response.json();

            if (data.erro) {
                toast({ variant: 'destructive', title: 'CEP não encontrado', description: 'O CEP informado não consta na base dos Correios.' });
                return;
            }

            const ufObj = ufs.find(u => u.sigla === data.uf);
            let updates = {
                endereco: `${data.logradouro}${data.bairro ? ', ' + data.bairro : ''}`
            };

            if (ufObj) {
                setSelectedUfSigla(data.uf);
                setSelectedUfIdForMunicipalities(ufObj.uf);

                // Buscar município pelo nome (padrão PersonEditorPage com resiliência)
                setTimeout(async () => {
                    try {
                        const { data: muniData, error: muniError } = await supabase
                            .from('municipios')
                            .select('codigo')
                            .eq('uf', ufObj.uf)
                            .ilike('municipio', `%${data.localidade}%`)
                            .maybeSingle();

                        if (!muniError && muniData) {
                            setObra(prev => ({ ...prev, municipio: muniData.codigo }));
                            console.log("ObraForm: Município sincronizado:", muniData.codigo);
                        }
                    } catch (err) {
                        console.error('ObraForm: Erro ao sincronizar município:', err);
                    }
                }, 800);
            }

            setObra(prev => ({ ...prev, ...updates }));
            toast({ title: 'CEP Encontrado', description: 'Endereço preenchido automaticamente.' });

        } catch (error) {
            console.error('ObraForm: Erro na busca de CEP:', error);
            if (error.name === 'AbortError') {
                toast({ variant: 'destructive', title: 'Timeout', description: 'A busca de CEP demorou muito. Verifique sua conexão.' });
            } else {
                toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Falha ao acessar serviço de CEP (CORS/Bloqueio). Preencha manualmente.' });
            }
        } finally {
            setBuscandoCep(false);
            clearTimeout(timeoutId);
        }
    };

    const handleCepBlur = () => {
        if (obra.cep) {
            const cepLimpo = obra.cep.replace(/\D/g, '');
            if (cepLimpo.length === 8) {
                buscarCep();
            }
        }
    };

    const handleSave = async () => {
        console.log("ObraForm: Iniciando processo de salvamento...");
        console.log("ObraForm: Estado da Obra:", obra);
        console.log("ObraForm: Empresa Ativa:", activeCompany);
        console.log("ObraForm: Usuário Atual:", user?.id);

        if (!obra.obra) {
            toast({ variant: 'destructive', title: 'Campo obrigatório', description: 'O campo Nome da Obra é obrigatório.' });
            return;
        }

        if (!activeCompany?.cnpj) {
            console.error("ObraForm: Erro - Empresa ativa sem CNPJ definido.");
            toast({ variant: 'destructive', title: 'Erro de Contexto', description: 'Não foi possível identificar a empresa ativa. Recarregue a página.' });
            return;
        }

        setSaving(true);
        try {
            const cleanCnpj = activeCompany.cnpj.replace(/\D/g, '');

            // 🔥 CORREÇÃO CRÍTICA: Remover campos que não existem na tabela (uf)
            // e também remover o 'id' do corpo para evitar conflitos no update
            const { uf, id: obraId, created_at, updated_at, ...obraData } = obra;

            // Helper para conversão numérica segura
            const parseNum = (val, fallback = null) => {
                if (val === '' || val === null || val === undefined) return fallback;
                const parsed = parseFloat(val);
                return isNaN(parsed) ? fallback : parsed;
            };

            const dataToSave = {
                ...obraData,
                empresa: cleanCnpj,
                contratante: selectedClient?.cpf_cnpj || obraData.contratante || null,
                // Sincronizar o nome do cliente na coluna 'cliente' para redundância/legibilidade
                cliente: selectedClient ? (selectedClient.razao_social || selectedClient.nome_fantasia) : (obraData.cliente || null),
                inicio: obra.inicio === '' ? null : obra.inicio,
                fim: obra.fim === '' ? null : obra.fim,
                latitude: parseNum(obra.latitude),
                longitude: parseNum(obra.longitude),
                valor_inicial: parseNum(obra.valor_inicial, 0),
                m2: parseNum(obra.m2, 0)
            };

            console.log("ObraForm: Enviando dados limpos e tipados para o Supabase:", dataToSave);

            let result;
            if (id) {
                result = await supabase.from('obras').update(dataToSave).eq('id', id);
            } else {
                result = await supabase.from('obras').insert([dataToSave]).select();
            }

            if (result.error) {
                console.error("ObraForm: Erro retornado pelo Supabase:", result.error);
                throw result.error;
            }

            console.log("ObraForm: Salvamento concluído com sucesso.");
            toast({ title: 'Sucesso', description: `Obra ${id ? 'atualizada' : 'cadastrada'} com sucesso!` });

            // Correção: logAction usa argumentos posicionais
            try {
                await logAction(
                    user.id,
                    id ? 'UPDATE' : 'INSERT',
                    `Obra: ${obra.obra} (Código: ${obra.codigo})`,
                    activeCompany?.id
                );
            } catch (logErr) {
                console.warn("ObraForm: Falha ao registrar log de ação (não impede o salvamento):", logErr);
            }

            if (onSaveSuccess) onSaveSuccess(result.data ? result.data[0] : null);
        } catch (error) {
            console.error("ObraForm: Exceção no handleSave:", error);
            toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message || 'Erro desconhecido ao salvar obra.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
    }

    const cepMask = '00000-000';
    const phoneMask = '(00) 00000-0000';

    return (
        <div className="pt-2 space-y-4 max-h-[75vh] overflow-y-auto px-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="form-group lg:col-span-2">
                    <Label htmlFor="codigo" className="form-label dark:text-slate-300">Código</Label>
                    <Input id="codigo" type="text" className="form-input bg-slate-50 dark:bg-slate-800 dark:border-slate-700" value={obra.codigo || ''} readOnly disabled />
                </div>
                <div className="form-group lg:col-span-6">
                    <Label htmlFor="obra" className="form-label dark:text-slate-300">Nome da Obra *</Label>
                    <Input id="obra" type="text" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.obra || ''} onChange={handleInputChange} autoComplete="off" />
                </div>
                <div className="form-group lg:col-span-4">
                    <Label htmlFor="status" className="form-label dark:text-slate-300">Status</Label>
                    <Select onValueChange={(value) => handleSelectChange('status', parseInt(value))} value={obra.status ? obra.status.toString() : ''}>
                        <SelectTrigger id="status" className="form-select w-full dark:bg-slate-950 dark:border-slate-700">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-900 dark:border-slate-700">
                            <SelectItem value="1">Em andamento</SelectItem>
                            <SelectItem value="2">Concluída</SelectItem>
                            <SelectItem value="3">Paralisada</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="form-group lg:col-span-3">
                    <Label htmlFor="cep" className="form-label dark:text-slate-300">CEP</Label>
                    <div className="flex gap-2">
                        <IMaskInput
                            mask={cepMask}
                            value={obra.cep || ''}
                            onAccept={(value) => handleInputChange({ target: { id: 'cep', value } })}
                            onBlur={handleCepBlur}
                            disabled={saving || buscandoCep}
                            id="cep"
                            type="text"
                            className="form-input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm dark:bg-slate-950 dark:border-slate-700"
                            placeholder="00000-000"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={buscarCep} disabled={buscandoCep || !obra.cep || saving} className="dark:border-slate-700 dark:hover:bg-slate-800">
                            {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="form-group lg:col-span-9">
                    <Label htmlFor="endereco" className="form-label dark:text-slate-300">Endereço</Label>
                    <Input id="endereco" type="text" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.endereco || ''} onChange={handleInputChange} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="form-group lg:col-span-3">
                    <Label htmlFor="uf" className="form-label dark:text-slate-300">
                        UF <span className="text-red-500">*</span>
                    </Label>
                    <Select
                        onValueChange={(value) => {
                            const ufObj = ufs.find(u => u.sigla === value);
                            if (ufObj) {
                                setSelectedUfSigla(value);
                                setSelectedUfIdForMunicipalities(ufObj.uf);
                                setObra(prev => ({ ...prev, estado: value, municipio: '' }));
                                fetchMunicipalities(ufObj.uf);
                            }
                        }}
                        value={selectedUfSigla}
                        disabled={saving}
                    >
                        <SelectTrigger id="uf" className="form-select dark:bg-slate-950 dark:border-slate-700 text-left">
                            <SelectValue placeholder="Selecione a UF" />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-900 dark:border-slate-700 max-h-[300px] overflow-y-auto" position="popper">
                            {ufs.map(uf => (
                                <SelectItem key={uf.uf} value={uf.sigla}>
                                    {uf.sigla} - {uf.estado}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="form-group lg:col-span-5">
                    <Label htmlFor="municipio" className="form-label dark:text-slate-300">
                        Município <span className="text-red-500">*</span>
                    </Label>
                    <SelectSearchMunicipality
                        value={obra.municipio}
                        onValueChange={(value) => setObra(prev => ({ ...prev, municipio: value }))}
                        municipalities={municipalities}
                        disabled={!selectedUfIdForMunicipalities || saving}
                        placeholder={selectedUfIdForMunicipalities ? "Selecione o município" : "Selecione a UF primeiro"}
                    />
                </div>
                <div className="form-group lg:col-span-2">
                    <Label htmlFor="latitude" className="form-label dark:text-slate-300">Latitude</Label>
                    <Input id="latitude" type="text" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.latitude || ''} onChange={handleInputChange} placeholder="-23..." />
                </div>
                <div className="form-group lg:col-span-2">
                    <Label htmlFor="longitude" className="form-label dark:text-slate-300">Longitude</Label>
                    <Input id="longitude" type="text" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.longitude || ''} onChange={handleInputChange} placeholder="-46..." />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="form-group lg:col-span-7">
                    <Label className="form-label dark:text-slate-300">Cliente / Contratante</Label>
                    <SelectSearchClient value={selectedClient} onValueChange={setSelectedClient} placeholder="Buscar cliente..." disabled={saving} />
                </div>
                <div className="form-group lg:col-span-5">
                    <Label htmlFor="contrato" className="form-label dark:text-slate-300">Nº Contrato</Label>
                    <Input id="contrato" type="text" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.contrato || ''} onChange={handleInputChange} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="form-group lg:col-span-4">
                    <Label htmlFor="responsavel" className="form-label dark:text-slate-300">Responsável</Label>
                    <Input id="responsavel" type="text" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.responsavel || ''} onChange={handleInputChange} />
                </div>
                <div className="form-group lg:col-span-4">
                    <Label htmlFor="tel_responsavel" className="form-label dark:text-slate-300">Telefone Resp.</Label>
                    <IMaskInput mask={phoneMask} value={obra.tel_responsavel || ''} onAccept={(value) => handleInputChange({ target: { id: 'tel_responsavel', value } })} disabled={saving} id="tel_responsavel" type="text" className="form-input flex h-10 w-full rounded-md border text-sm dark:bg-slate-950 dark:border-slate-700" />
                </div>
                <div className="form-group lg:col-span-4">
                    <Label htmlFor="m2" className="form-label dark:text-slate-300">M²</Label>
                    <Input id="m2" type="number" step="0.01" className="form-input dark:bg-slate-950 dark:border-slate-700" value={obra.m2 || ''} onChange={handleInputChange} />
                </div>
            </div>

            <div className="form-group">
                <Label className="form-label mb-2 block dark:text-slate-300">Tipo de Obra</Label>
                <div className="flex flex-wrap gap-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    {['edificacao', 'obra_viaria', 'oae', 'linear', 'localizada'].map(type => (
                        <div key={type} className="flex items-center space-x-2">
                            <Checkbox id={type} checked={obra[type] === 1} onCheckedChange={(checked) => handleCheckboxChange(type, checked)} className="dark:border-slate-500" />
                            <label htmlFor={type} className="text-sm capitalize cursor-pointer dark:text-slate-300">{type.replace('_', ' ')}</label>
                        </div>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <Label htmlFor="observacao" className="form-label dark:text-slate-300">Observações</Label>
                <Textarea id="observacao" className="form-textarea dark:bg-slate-950 dark:border-slate-700" value={obra.observacao || ''} onChange={handleInputChange} rows={3} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 pb-2">
                {onCancel && <Button variant="ghost" onClick={onCancel} disabled={saving} className="dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</Button>}
                <Button onClick={handleSave} className="save-button min-w-[120px]" disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar Obra
                </Button>
            </div>
        </div>
    );
};

export default ObraForm;
