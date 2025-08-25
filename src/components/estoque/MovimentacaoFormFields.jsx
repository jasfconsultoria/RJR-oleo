import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Info, User, Tag } from 'lucide-react';
import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import { format } from 'date-fns';

const MovimentacaoFormFields = ({ formData, handleChange, handleSelectChange, isEditing, type, loadingClients }) => {
  const originOptions = [
    { value: 'manual', label: 'Manual' },
    // { value: 'coleta', label: 'Coleta' }, // Future integration
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

      <div className="md:col-span-2">
        <ClienteSearchableSelect
          labelText="Cliente *"
          value={formData.cliente_id}
          onChange={(value) => handleSelectChange('cliente_id', value)}
          loading={loadingClients}
          disabled={isEditing}
          required // Making it required
        />
      </div>
    </div>
  );
};

export default MovimentacaoFormFields;