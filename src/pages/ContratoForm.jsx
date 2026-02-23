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
import { logAction } from '@/lib/logger';
import { formatToISODate, parseCurrency } from '@/lib/utils'; // Importar parseCurrency
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import ContratoPDF from '@/components/ContratoPDF';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label'; // Importar Label

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
        valor_coleta: '0,00', // Alterado de null para '0,00' (string)
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
                valor_coleta: String(data.valor_coleta || '0,00').replace('.', ','), // Garante que é string com vírgula
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
        
        // Nova validação para valor_coleta
        if (formData.tipo_coleta === 'Compra') {
            const valorNumerico = parseCurrency(formData.valor_coleta); // Usar parseCurrency
            if (isNaN(valorNumerico) || valorNumerico <= 0) {
                newErrors.valor_coleta = 'Valor da compra deve ser maior que zero.';
            }
        }

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
                valor_coleta: formData.tipo_coleta === 'Compra' ? (parseCurrency(formData.valor_coleta) || null) : null, // Converte para float usando parseCurrency
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
        return (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        );
    }
    
    return (
        <>
            <Helmet>
                <title>{isEditing ? 'Editar Contrato' : 'Novo Contrato'} - RJR Óleo</title>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <Label htmlFor="statusFilter" className="block text-white mb-1 text-sm">Status</Label>
                                <div className="relative">
                                    <select
                                        id="statusFilter"
                                        value={formData.status}
                                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                        className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 appearance-none"
                                    >
                                        <option value="Aguardando Assinatura">Aguardando Assinatura</option>
                                        <option value="Ativo">Ativo</option>
                                        <option value="Inativo">Inativo</option>
                                        <option value="Cancelado">Cancelado</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        <svg className="h-4 w-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                {errors.status && <p className="text-red-500 text-sm mt-1">{errors.status}</p>}
                            </div>
                            <ContratoFields 
                                formData={formData} 
                                setFormData={setFormData}
                                loading={loading}
                                errors={errors}
                                empresaTimezone={empresa?.timezone || 'America/Sao_Paulo'}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" onClick={() => navigate('/app/cadastro/contratos')} disabled={isSaving}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSaving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Salvar')}
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