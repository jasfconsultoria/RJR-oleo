import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Hash, Factory, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import ColetaSearchableSelect from '@/components/ui/ColetaSearchableSelect';
import { Button } from '@/components/ui/button'; // Importando o componente Button
import { DatePicker } from '@/components/ui/date-picker'; // Importar DatePicker

const MovimentacaoFormFields = ({ formData, handleChange, handleSelectChange, handleColetaSelect, isEditing, type, documentNumberRef }) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data" className="text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Data *
          </Label>
          <DatePicker
            date={formData.data}
            setDate={(date) => handleChange('data', date)}
            className="w-full bg-white/5 border-white/20 text-white rounded-xl"
            disabled={isEditing}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="origem" className="text-white flex items-center gap-2">
            <Factory className="w-4 h-4" /> Origem *
          </Label>
          <Select
            value={formData.origem}
            onValueChange={(value) => handleSelectChange('origem', value)}
            disabled={isEditing}
          >
            <SelectTrigger className="w-full bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl">
              <SelectValue placeholder="Selecione a origem" />
            </SelectTrigger>
            <SelectContent className="bg-white/10 border-white/20 text-white rounded-xl">
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="coleta">Coleta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.origem === 'coleta' && (
        <div className="space-y-2">
          <Label htmlFor="coleta_id" className="text-white flex items-center gap-2">
            <Truck className="w-4 h-4" /> Coleta *
          </Label>
          <ColetaSearchableSelect
            value={formData.coleta_id}
            onChange={handleColetaSelect}
            type={type}
            disabled={isEditing}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="document_number" className="text-white flex items-center gap-2">
          <Hash className="w-4 h-4" /> Número do Documento
        </Label>
        <Input
          id="document_number"
          name="document_number"
          value={formData.document_number}
          onChange={(e) => handleChange('document_number', e.target.value)}
          placeholder="Número do Documento"
          className="bg-white/5 border-white/20 text-white placeholder:text-white/60 rounded-xl"
          disabled={isEditing}
          ref={documentNumberRef} // Aplicando a ref aqui
        />
      </div>
    </>
  );
};

export default MovimentacaoFormFields;