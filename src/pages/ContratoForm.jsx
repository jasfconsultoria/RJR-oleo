import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ContratoFields from '@/components/contratos/ContratoFields';
import { ArrowLeft, Save, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { logAction } from '@/lib/logger';
import { formatToISODate } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import ContratoPDF from '@/components/ContratoPDF';
import { Progress } from '@/components/ui/progress';

const ContratoForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isEditing = !!id;
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [originalContrato, setOriginalContrato] = useState(null);
    const [empresa, setEmpresa] = useState(null);
    const [progress, setProgress] = useState(0);
    const [pdfData, setPdfData] = useState(null);
    const pdfContainerRef = useRef(null);
    
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
            navigate('/app/cadastro/contratos');
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
            const { data: empresaData, error: empresaError } = await supabase.from('empresa').select('*').single();
            if (empresaError) {
                toast({ title: 'Erro ao buscar dados da empresa', variant: 'destructive' });
            } else {
                setEmpresa(empresaData);
            }

            if (isEditing) {
                await fetchContrato(id);
            } else {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [isEditing, id, fetchContrato, toast]);

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
        setProgress(10);
        
        try {
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
    
            const { data: savedContract, error: saveError } = await supabase
                .from('contratos')
                .upsert(dataToSave, { onConflict: 'id' })
                .select('*, pessoa:clientes(*)')
                .single();
    
            if (saveError) throw saveError;
            setProgress(30);

            setPdfData(savedContract);
            await new Promise(resolve => setTimeout(resolve, 200));

            const input = pdfContainerRef.current.firstChild;
            if (!input) throw new Error('Falha ao renderizar o componente do PDF.');
            
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            setProgress(60);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgProps = pdf.getImageProperties(imgData);
            const ratio = Math.min(pdfWidth / imgProps.width, pdfHeight / imgProps.height);
            const width = imgProps.width * ratio;
            const height = imgProps.height * ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            
            const pdfBlob = pdf.output('blob');
            setProgress(75);

            const dateStr = format(new Date(), 'yyyy-MM-dd');
            const fileName = `contratos/Contrato_${savedContract.numero_contrato}_${dateStr}.pdf`;

            const { error: uploadError } = await supabase.storage.from('contratos').upload(fileName, pdfBlob, { upsert: true });
            if (uploadError) throw uploadError;
            setProgress(90);

            const { data: urlData } = supabase.storage.from('contratos').getPublicUrl(fileName);
            
            const { error: dbError } = await supabase.from('contratos').update({ pdf_url: urlData.publicUrl }).eq('id', savedContract.id);
            if (dbError) throw dbError;
            setProgress(100);

            await logAction(isEditing ? 'update_contrato' : 'create_contrato', { contrato_id: savedContract.id, numero_contrato: savedContract.numero_contrato });
            
            toast({
                title: 'Sucesso!',
                description: `Contrato ${isEditing ? 'atualizado' : 'salvo'} com sucesso.`,
                variant: 'success',
                duration: 10000,
                action: (
                    <ToastAction altText="Abrir Contrato" onClick={() => {
                        if (savedContract.status === 'Aguardando Assinatura') {
                            navigate(`/assinatura/${savedContract.id}`);
                        } else if (savedContract.status === 'Ativo') {
                            navigate(`/contrato-assinado/${savedContract.id}`);
                        } else {
                            toast({ title: 'Ação não disponível', description: `Não é possível abrir o contrato com status "${savedContract.status}".`, variant: 'destructive' });
                        }
                    }}>
                        Abrir Contrato
                    </ToastAction>
                ),
            });

            setTimeout(() => {
                navigate('/app/cadastro/contratos');
            }, 800);

        } catch (error) {
            console.error("Erro ao salvar contrato:", error);
            toast({ title: 'Erro ao salvar contrato', description: error.message, variant: 'destructive' });
            setIsSaving(false);
            setProgress(0);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></div>;
    }
    
    return (
        <>
            <Helmet>
                <title>{isEditing ? 'Editar Contrato' : 'Novo Contrato'} - Sistema de Gestão</title>
            </Helmet>

            <div className="relative max-w-4xl mx-auto">
                {isSaving && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col justify-center items-center z-20 rounded-xl p-8 outline-none">
                        {progress < 100 ? (
                            <>
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                                <p className="text-white mt-4 text-lg">Salvando e gerando PDF...</p>
                                <p className="text-emerald-300 text-sm mb-4">Por favor, aguarde.</p>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-10 h-10 text-emerald-400" />
                                <p className="text-white mt-4 text-lg">Concluído!</p>
                            </>
                        )}
                        <Progress value={progress} className="w-3/4 mt-4" />
                    </div>
                )}
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm rounded-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl text-white flex items-center justify-between">
                          {isEditing ? `Contrato: ${formData.numero_contrato}` : 'Novo Contrato'}
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
                            empresaTimezone={empresa?.timezone || 'America/Sao_Paulo'}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => navigate('/app/cadastro/contratos')} disabled={isSaving}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isEditing ? 'Salvar Alterações' : 'Salvar'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
            <div ref={pdfContainerRef} style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
                {pdfData && empresa && <ContratoPDF contrato={pdfData} empresa={empresa} />}
            </div>
        </>
    );
};

export default ContratoForm;