import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ContratoFields from '@/components/contratos/ContratoFields';
import { ArrowLeft, Save, Loader2, Share2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { logAction } from '@/lib/logger';
import ContratoViewModal from '@/components/contratos/ContratoViewModal';
import { formatToISODate } from '@/lib/utils';

const ContratoForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditing = !!id;
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [originalContrato, setOriginalContrato] = useState(null);
    const [empresaTimezone, setEmpresaTimezone] = useState('America/Sao_Paulo');
    
    const [formData, setFormData] = useState({
        cliente_id: null,
        numero_contrato: '',
        data_inicio: new Date(),
        data_fim: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        status: 'Aguardando Assinatura',
        tipo_coleta: 'Troca',
        valor_coleta: null,
        fator_troca: '6',
        frequencia_coleta: 'Semanal',
        usa_recipiente: false,
        qtd_recipiente: '',
        assinatura_url: null,
        pessoa: null,
    });

    const fetchContrato = useCallback(async (contratoId) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('contratos')
            .select('*, pessoa:clientes(*)')
            .eq('id', contratoId)
            .single();

        if (error) {
            toast({ title: 'Erro ao carregar contrato', variant: 'destructive' });
            navigate('/app/contratos');
        } else {
            const parseDateWithTimezone = (dateString) => {
                if (!dateString) return null;
                return new Date(`${dateString}T00:00:00`);
            };

            const formDataFromDB = {
                ...data,
                data_inicio: parseDateWithTimezone(data.data_inicio),
                data_fim: parseDateWithTimezone(data.data_fim),
                pessoa: data.pessoa,
            };
            setFormData(formDataFromDB);
            setOriginalContrato(data);
        }
        setLoading(false);
    }, [navigate, toast]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: empresaData } = await supabase.from('empresa').select('timezone').single();
            if (empresaData?.timezone) {
                setEmpresaTimezone(empresaData.timezone);
            }

            if (isEditing) {
                await fetchContrato(id);
            } else {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [isEditing, id, fetchContrato]);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.cliente_id) newErrors.cliente_id = 'Cliente é obrigatório.';
        if (!formData.status) newErrors.status = 'Status é obrigatório.';
        if (!formData.data_inicio) newErrors.data_inicio = 'Data de início é obrigatória.';
        if (!formData.data_fim) newErrors.data_fim = 'Data de fim é obrigatória.';
        if (formData.data_fim && formData.data_inicio && formData.data_fim < formData.data_inicio) {
            newErrors.data_fim = 'Data de fim não pode ser anterior à data de início.';
        }
        if (!formData.tipo_coleta) newErrors.tipo_coleta = 'Tipo de coleta é obrigatório.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) {
            toast({ title: "Verifique os campos", description: "Alguns campos obrigatórios não foram preenchidos.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        
        const dataToSave = {
            ...formData,
            user_id: user.id,
            data_inicio: formatToISODate(formData.data_inicio),
            data_fim: formatToISODate(formData.data_fim),
            valor_coleta: formData.tipo_coleta === 'Compra' ? (formData.valor_coleta || null) : null,
            fator_troca: formData.tipo_coleta === 'Troca' ? (formData.fator_troca || null) : null,
            qtd_recipiente: formData.usa_recipiente ? (parseInt(formData.qtd_recipiente, 10) || null) : null,
        };

        if (isEditing && originalContrato?.status === 'Ativo') {
            dataToSave.status = 'Aguardando Assinatura';
            dataToSave.assinatura_url = null;
            toast({ title: 'Contrato alterado', description: 'Uma nova assinatura será necessária.' });
        }
        
        delete dataToSave.pessoa;

        const { data, error } = await supabase
            .from('contratos')
            .upsert(dataToSave, { onConflict: 'id' })
            .select('id, numero_contrato, status')
            .single();

        if (error) {
            console.error("Erro ao salvar contrato:", error);
            toast({ title: 'Erro ao salvar contrato', description: error.message, variant: 'destructive' });
            setIsSaving(false);
        } else {
            await logAction(isEditing ? 'update_contrato' : 'create_contrato', { contrato_id: data.id, numero_contrato: data.numero_contrato });
            toast({ title: 'Sucesso!', description: `Contrato ${isEditing ? 'atualizado' : 'salvo'} com sucesso.` });

            if (isEditing && (formData.status === 'Inativo' || formData.status === 'Cancelado')) {
                navigate('/app/contratos');
                return;
            }

            const { data: fullContrato, error: fetchError } = await supabase
                .from('contratos')
                .select('*, pessoa:clientes(*)')
                .eq('id', data.id)
                .single();

            if (fetchError) {
                toast({ title: 'Erro ao recarregar dados do contrato', description: fetchError.message, variant: 'destructive' });
                if (!isEditing) navigate(`/app/contratos/editar/${data.id}`);
            } else {
                const parseDateWithTimezone = (dateString) => {
                    if (!dateString) return null;
                    return new Date(`${dateString}T00:00:00`);
                };
                const updatedFormData = {
                    ...fullContrato,
                    data_inicio: parseDateWithTimezone(fullContrato.data_inicio),
                    data_fim: parseDateWithTimezone(fullContrato.data_fim),
                    pessoa: fullContrato.pessoa,
                };

                setFormData(updatedFormData);
                setOriginalContrato(fullContrato);
                
                setIsViewModalOpen(true);
                
                if (!isEditing) {
                    navigate(`/app/contratos/editar/${data.id}`, { replace: true });
                }
            }
            setIsSaving(false);
        }
    };

    const handleCloseModal = () => {
        setIsViewModalOpen(false);
        navigate('/app/contratos');
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
    }
    
    return (
        <>
            <Helmet>
                <title>{isEditing ? 'Editar Contrato' : 'Novo Contrato'} - Sistema de Gestão</title>
            </Helmet>

            {isViewModalOpen && (
                <ContratoViewModal
                    contrato={formData}
                    isOpen={isViewModalOpen}
                    onClose={handleCloseModal}
                />
            )}

            <Card className="max-w-4xl mx-auto bg-white/5 border-white/10 backdrop-blur-sm rounded-xl">
                <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center justify-between">
                      {isEditing ? `Contrato: ${formData.numero_contrato}` : 'Novo Contrato'}
                      {isEditing && (
                        <Button onClick={() => setIsViewModalOpen(true)} variant="outline" size="sm">
                            <Share2 className="w-4 h-4 mr-2" />
                            Visualizar/Compartilhar
                        </Button>
                      )}
                    </CardTitle>
                    <CardDescription className="text-emerald-200/80">
                        Preencha os dados abaixo para {isEditing ? 'editar o' : 'criar um novo'} contrato.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ContratoFields 
                        formData={formData} 
                        setFormData={setFormData}
                        loading={loading}
                        errors={errors}
                        empresaTimezone={empresaTimezone}
                    />
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => navigate('/app/contratos')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isEditing ? 'Salvar Alterações' : 'Salvar'}
                    </Button>
                </CardFooter>
            </Card>
        </>
    );
};

export default ContratoForm;