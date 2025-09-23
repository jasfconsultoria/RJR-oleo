import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Info, User, Tag } from 'lucide-react';
// Removido: import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import ColetaSearchableSelect from '@/components/ui/ColetaSearchableSelect'; // New import
import { format } from 'date-fns';

const MovimentacaoFormFields = ({ formData, handleChange, handleSelectChange, handleColetaSelect, isEditing, type, loadingClients }) => {
  const originOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'coleta', label: 'Coleta' }, // Added Coleta origin
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
      <div>
        <Label htmlFor="data" className="text-lg flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Data *
        </Label>
        <Input
          id="data"
          name="data"
          type="date"
          value={format(formData.data, 'yyyy-MM-dd')}
          onChange={(e) => handleChange('data', new Date(e.target.value))}
          className="bg-white/5 border-white/20 rounded-xl"
          required
          disabled={isEditing}
        />
      </div>

      <div>
        <Label htmlFor="origem" className="text-lg flex items-center gap-2">
          <Tag className="w-4 h-4" /> Origem *
        </Label>
        <Select value={formData.origem} onValueChange={(value) => handleSelectChange('origem', value)} disabled={isEditing}>
          <SelectTrigger className="bg-white/5 border-white/20 rounded-xl">
            <SelectValue placeholder="Selecione a origem" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
            {originOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* New Document Number Field */}
      <div>
        <Label htmlFor="document_number" className="text-lg flex items-center gap-2">
          <Info className="w-4 h-4" /> Nº Documento
        </Label>
        <Input
          id="document_number"
          name="document_number"
          value={formData.document_number}
          onChange={(e) => handleChange('document_number', e.target.value)}
          placeholder="Ex: NF-12345, Recibo-001"
          className="bg-white/5 border-white/20 rounded-xl"
          disabled={isEditing || formData.origem === 'coleta'} // Disable if editing or origin is coleta
        />
      </div>

      {formData.origem === 'coleta' && (
        <div className="md:col-span-2">
          <ColetaSearchableSelect
            labelText="Selecionar Coleta *"
            value={formData.coleta_id}
            onChange={handleColetaSelect}
            disabled={isEditing}
          />
        </div>
      )}
      {/* O campo de cliente para origem 'manual' será renderizado no componente pai (EntradaFormPage/SaidaFormPage) */}
    </div>
  );
};

export default MovimentacaoFormFields;