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
import ColetaSearchableSelect from './ColetaSearchableSelect';

const MovimentacaoFormFields = ({ formData, handleChange, handleSelectChange, handleColetaSelect, isEditing, type, documentNumberRef }) => {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data" className="text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" /> Data *
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white rounded-xl",
                  !formData.data && "text-white/60"
                )}
                disabled={isEditing}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.data ? format(formData.data, "PPP", { locale: ptBR }) : <span>Selecione uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white/10 border-white/20 text-white rounded-xl" align="start">
              <Calendar
                mode="single"
                selected={formData.data}
                onSelect={(date) => handleChange('data', date)}
                initialFocus
                locale={ptBR}
                disabled={isEditing}
              />
            </PopoverContent>
          </Popover>
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