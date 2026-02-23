import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import ClienteSearchableSelect from '@/components/clientes/ClienteSearchableSelect';

const ContratoFields = ({ formData, setFormData, loading, errors, empresaTimezone }) => {
    const [clientes, setClientes] = useState([]);
    const [loadingClientes, setLoadingClientes] = useState(true);

    useEffect(() => {
        const fetchClientes = async () => {
            const { data, error } = await supabase
                .from('clientes')
                .select('id, nome_fantasia, razao_social, cnpj_cpf, municipio, estado')
                .order('nome_fantasia');
            
            if (!error) {
                setClientes(data || []);
            }
            setLoadingClientes(false);
        };
        fetchClientes();
    }, []);

    const handleClienteChange = (clienteId) => {
        if (clienteId === null) {
            setFormData(prev => ({
                ...prev,
                cliente_id: null,
                pessoa: null
            }));
            return;
        }
        
        const clienteSelecionado = clientes.find(c => c.id === clienteId);
        
        setFormData(prev => ({
            ...prev,
            cliente_id: clienteId,
            pessoa: clienteSelecionado
        }));
    };

    const handleDateChange = (field, date) => {
        setFormData(prev => ({
            ...prev,
            [field]: date
        }));
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleTipoColetaChange = (tipo) => {
        setFormData(prev => ({
            ...prev,
            tipo_coleta: tipo,
            valor_coleta: tipo === 'Compra' ? '0,00' : '',
            fator_troca: tipo === 'Troca' ? '6' : ''
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Cliente com ClienteSearchableSelect */}
            <div className="space-y-2">
                <ClienteSearchableSelect
                    clientes={clientes}
                    value={formData.cliente_id}
                    onChange={handleClienteChange}
                    loading={loadingClientes}
                    error={errors.cliente_id}
                />
                {errors.cliente_id && <p className="text-red-400 text-sm mt-1">{errors.cliente_id}</p>}
            </div>

            {/* Número do Contrato */}
            <div className="space-y-2">
                <Label htmlFor="numero_contrato" className="text-white">Número do Contrato</Label>
                <Input
                    id="numero_contrato"
                    value={formData.numero_contrato}
                    onChange={(e) => handleInputChange('numero_contrato', e.target.value)}
                    placeholder="Será gerado automaticamente ao salvar"
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                    disabled
                />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-white">Data de Início *</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                                    !formData.data_inicio && "text-gray-400",
                                    errors.data_inicio && "border-red-400"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.data_inicio ? (
                                    format(formData.data_inicio, "dd/MM/yyyy")
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-gray-900 border-white/20">
                            <Calendar
                                mode="single"
                                selected={formData.data_inicio}
                                onSelect={(date) => handleDateChange('data_inicio', date)}
                                initialFocus
                                locale={ptBR}
                                className="bg-gray-900 text-white"
                            />
                        </PopoverContent>
                    </Popover>
                    {errors.data_inicio && <p className="text-red-400 text-sm mt-1">{errors.data_inicio}</p>}
                </div>

                <div className="space-y-2">
                    <Label className="text-white">Data de Fim *</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20",
                                    !formData.data_fim && "text-gray-400",
                                    errors.data_fim && "border-red-400"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {formData.data_fim ? (
                                    format(formData.data_fim, "dd/MM/yyyy")
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-gray-900 border-white/20">
                            <Calendar
                                mode="single"
                                selected={formData.data_fim}
                                onSelect={(date) => handleDateChange('data_fim', date)}
                                initialFocus
                                locale={ptBR}
                                className="bg-gray-900 text-white"
                            />
                        </PopoverContent>
                    </Popover>
                    {errors.data_fim && <p className="text-red-400 text-sm mt-1">{errors.data_fim}</p>}
                </div>
            </div>

            {/* Status e Tipo de Coleta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="status" className="text-white">Status *</Label>
                    <Select 
                        value={formData.status} 
                        onValueChange={(value) => handleInputChange('status', value)}
                    >
                        <SelectTrigger className={cn(
                            "bg-white/10 border-white/20 text-white",
                            errors.status && 'border-red-400'
                        )}>
                            <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/20 text-white">
                            <SelectItem value="Aguardando Assinatura">Aguardando Assinatura</SelectItem>
                            <SelectItem value="Ativo">Ativo</SelectItem>
                            <SelectItem value="Inativo">Inativo</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.status && <p className="text-red-400 text-sm mt-1">{errors.status}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="tipo_coleta" className="text-white">Tipo de Coleta *</Label>
                    <Select 
                        value={formData.tipo_coleta} 
                        onValueChange={handleTipoColetaChange}
                    >
                        <SelectTrigger className={cn(
                            "bg-white/10 border-white/20 text-white",
                            errors.tipo_coleta && 'border-red-400'
                        )}>
                            <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/20 text-white">
                            <SelectItem value="Troca">Troca</SelectItem>
                            <SelectItem value="Compra">Compra</SelectItem>
                            <SelectItem value="Doação">Doação</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.tipo_coleta && <p className="text-red-400 text-sm mt-1">{errors.tipo_coleta}</p>}
                </div>
            </div>

            {/* Campos condicionais baseados no tipo de coleta */}
            {formData.tipo_coleta === 'Compra' && (
                <div className="space-y-2">
                    <Label htmlFor="valor_coleta" className="text-white">Valor por Kg (R$) *</Label>
                    <Input
                        id="valor_coleta"
                        value={formData.valor_coleta}
                        onChange={(e) => handleInputChange('valor_coleta', e.target.value)}
                        placeholder="0,00"
                        inputMode="decimal"
                        className={cn(
                            "bg-white/10 border-white/20 text-white",
                            errors.valor_coleta && 'border-red-400'
                        )}
                    />
                    {errors.valor_coleta && <p className="text-red-400 text-sm mt-1">{errors.valor_coleta}</p>}
                </div>
            )}

            {formData.tipo_coleta === 'Troca' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fator_troca" className="text-white">Fator de Troca (kg de óleo por L de produto)</Label>
                        <Input
                            id="fator_troca"
                            value={formData.fator_troca}
                            onChange={(e) => handleInputChange('fator_troca', e.target.value)}
                            placeholder="6"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="bg-white/10 border-white/20 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="frequencia_coleta" className="text-white">Frequência de Coleta</Label>
                        <Select 
                            value={formData.frequencia_coleta} 
                            onValueChange={(value) => handleInputChange('frequencia_coleta', value)}
                        >
                            <SelectTrigger className="bg-white/10 border-white/20 text-white">
                                <SelectValue placeholder="Selecione a frequência" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-white/20 text-white">
                                <SelectItem value="Semanal">Semanal</SelectItem>
                                <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                                <SelectItem value="Mensal">Mensal</SelectItem>
                                <SelectItem value="Bimestral">Bimestral</SelectItem>
                                <SelectItem value="Trimestral">Trimestral</SelectItem>
                                <SelectItem value="Sob Demanda">Sob Demanda</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* Frequência de Coleta (para outros tipos) */}
            {formData.tipo_coleta !== 'Troca' && (
                <div className="space-y-2">
                    <Label htmlFor="frequencia_coleta" className="text-white">Frequência de Coleta</Label>
                    <Select 
                        value={formData.frequencia_coleta} 
                        onValueChange={(value) => handleInputChange('frequencia_coleta', value)}
                    >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Selecione a frequência" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-white/20 text-white">
                            <SelectItem value="Semanal">Semanal</SelectItem>
                            <SelectItem value="Quinzenal">Quinzenal</SelectItem>
                            <SelectItem value="Mensal">Mensal</SelectItem>
                            <SelectItem value="Bimestral">Bimestral</SelectItem>
                            <SelectItem value="Trimestral">Trimestral</SelectItem>
                            <SelectItem value="Sob Demanda">Sob Demanda</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Recipiente */}
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    <Checkbox
                        id="usa_recipiente"
                        checked={formData.usa_recipiente}
                        onCheckedChange={(checked) => handleInputChange('usa_recipiente', checked)}
                        className="border-white/20 data-[state=checked]:bg-emerald-600"
                    />
                    <Label htmlFor="usa_recipiente" className="text-white cursor-pointer">
                        Usa Recipiente da Contratada?
                    </Label>
                </div>

                {formData.usa_recipiente && (
                    <div className="space-y-2">
                        <Label htmlFor="qtd_recipiente" className="text-white">Quantidade de Recipientes</Label>
                        <Input
                            id="qtd_recipiente"
                            type="number"
                            value={formData.qtd_recipiente}
                            onChange={(e) => handleInputChange('qtd_recipiente', e.target.value)}
                            placeholder="1"
                            min="1"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="bg-white/10 border-white/20 text-white"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContratoFields;