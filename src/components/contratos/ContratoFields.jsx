import React from 'react';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { formatNumber, parseCurrency } from '@/lib/utils'; // Import formatNumber and parseCurrency
import { IMaskInput } from 'react-imask'; // Import IMaskInput

const frequenciaOptions = [
  { value: 'Diária', label: 'Diária' },
  { value: 'Semanal', label: 'Semanal' },
  { value: 'Quinzenal', label: 'Quinzenal' },
  { value: 'Mensal', label: 'Mensal' },
  { value: 'Trimestral', label: 'Trimestral' },
  { value: 'Semestral', label: 'Semestral' },
  { value: 'Anual', label: 'Anual' },
];

const ContratoFields = ({ formData, setFormData, loading, errors, empresaTimezone }) => {
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleCheckboxChange = (checked) => {
    setFormData(prev => ({ 
        ...prev, 
        usa_recipiente: checked,
        qtd_recipiente: checked ? (prev.qtd_recipiente || '1') : '',
    }));
  };

  const parseAndSetDate = (field, date) => {
    setFormData(prev => ({ ...prev, [field]: date }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
      <div className="md:col-span-2">
        <ClienteSearchableSelect
          labelText="Cliente *"
          value={formData.cliente_id}
          onChange={(value) => setFormData(prev => ({ ...prev, cliente_id: value }))} // Update cliente_id directly
          loading={loading}
          disabled={!!formData.id}
        />
        {errors.cliente_id && <p className="text-red-400 text-sm mt-1">{errors.cliente_id}</p>}
      </div>

      <div>
        <Label htmlFor="numero_contrato">Número do Contrato</Label>
        <Input
          id="numero_contrato"
          value={formData.numero_contrato || 'Será gerado ao salvar'}
          disabled
        />
      </div>

      <div>
        <Label htmlFor="status">Status *</Label>
        <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
          <SelectTrigger id="status"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-gray-800 text-white">
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
            <SelectItem value="Cancelado">Cancelado</SelectItem>
            <SelectItem value="Aguardando Assinatura">Aguardando Assinatura</SelectItem>
          </SelectContent>
        </Select>
        {errors.status && <p className="text-red-400 text-sm mt-1">{errors.status}</p>}
      </div>

      <div>
        <Label htmlFor="data_inicio">Data de Início *</Label>
        <DateInput
          date={formData.data_inicio}
          setDate={(date) => parseAndSetDate('data_inicio', date)}
        />
        {errors.data_inicio && <p className="text-red-400 text-sm mt-1">{errors.data_inicio}</p>}
      </div>

      <div>
        <Label htmlFor="data_fim">Data de Fim *</Label>
        <DateInput
          date={formData.data_fim}
          setDate={(date) => parseAndSetDate('data_fim', date)}
        />
        {errors.data_fim && <p className="text-red-400 text-sm mt-1">{errors.data_fim}</p>}
      </div>
      
      <div>
        <Label htmlFor="tipo_coleta">Tipo de Coleta *</Label>
        <Select value={formData.tipo_coleta} onValueChange={(value) => handleInputChange('tipo_coleta', value)}>
          <SelectTrigger id="tipo_coleta"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-gray-800 text-white">
            <SelectItem value="Compra">Compra</SelectItem>
            <SelectItem value="Troca">Troca</SelectItem>
            <SelectItem value="Doação">Doação</SelectItem>
          </SelectContent>
        </Select>
        {errors.tipo_coleta && <p className="text-red-400 text-sm mt-1">{errors.tipo_coleta}</p>}
      </div>
      
      {formData.tipo_coleta === 'Compra' && (
        <div>
          <Label htmlFor="valor_coleta">Valor da Compra (R$ por Kg)</Label>
          <IMaskInput
            mask="num"
            blocks={{
              num: {
                mask: Number,
                thousandsSeparator: '.',
                radix: ',',
                mapToRadix: ['.'],
                scale: 2,
                padFractionalZeros: true,
                normalizeZeros: true,
                signed: false,
              },
            }}
            value={formData.valor_coleta !== null && formData.valor_coleta !== undefined 
                     ? String(formData.valor_coleta).replace('.', ',') 
                     : '0,00'} 
            onAccept={(value, mask) => handleInputChange('valor_coleta', mask.typedValue)} // Usar mask.typedValue para obter o número
            placeholder="0,00"
            className="w-full flex h-10 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      )}
      
      {formData.tipo_coleta === 'Troca' && (
        <div>
          <Label htmlFor="fator_troca">Fator de Troca (kg de óleo por L de produto)</Label>
          <Input
            id="fator_troca"
            type="number"
            value={formData.fator_troca || ''}
            onChange={(e) => handleInputChange('fator_troca', e.target.value)}
          />
        </div>
      )}
      
      <div>
        <Label htmlFor="frequencia_coleta">Frequência de Coleta</Label>
        <Select value={formData.frequencia_coleta} onValueChange={(value) => handleInputChange('frequencia_coleta', value)}>
          <SelectTrigger id="frequencia_coleta"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-gray-800 text-white">
            {frequenciaOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex items-center gap-2 pt-6">
        <Checkbox
          id="usa_recipiente"
          checked={formData.usa_recipiente}
          onCheckedChange={handleCheckboxChange}
          className="border-white/50 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
        />
        <Label htmlFor="usa_recipiente">Usa Recipiente da Contratada?</Label>
      </div>

      {formData.usa_recipiente && (
        <div>
          <Label htmlFor="qtd_recipiente">Quantidade de Recipientes</Label>
          <Input
            id="qtd_recipiente"
            type="number"
            value={formData.qtd_recipiente || ''}
            onChange={(e) => handleInputChange('qtd_recipiente', e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

export default ContratoFields;