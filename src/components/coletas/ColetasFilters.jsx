import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, XCircle } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ClienteSearchableSelect from '@/components/ClienteSearchableSelect';

const ColetasFilters = ({ clients, filters, onFilterChange, onClearFilters }) => {
  const clientOptions = clients.map(client => ({
    value: client.id,
    label: client.nome_fantasia ? `${client.nome} - ${client.nome_fantasia}` : client.nome,
  }));

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <Label htmlFor="numeroColetaTerm" className="block text-white mb-1 text-sm">Nº Coleta</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              id="numeroColetaTerm"
              type="search"
              placeholder="Buscar por número..."
              value={filters.numeroColetaTerm}
              onChange={(e) => onFilterChange('numeroColetaTerm', e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="clienteNameTerm" className="block text-white mb-1 text-sm">Cliente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              id="clienteNameTerm"
              type="search"
              placeholder="Buscar por nome do cliente..."
              value={filters.clienteNameTerm}
              onChange={(e) => onFilterChange('clienteNameTerm', e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
          <DatePicker
            date={filters.startDate}
            setDate={(date) => onFilterChange('startDate', date)}
            className="w-full bg-white/20 border-white/30 text-white rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
          <DatePicker
            date={filters.endDate}
            setDate={(date) => onFilterChange('endDate', date)}
            className="w-full bg-white/20 border-white/30 text-white rounded-xl"
          />
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <Button 
          variant="outline" 
          onClick={onClearFilters} 
          className="bg-transparent text-white border-gray-400 hover:bg-gray-700 hover:text-white rounded-xl"
        >
          <XCircle className="mr-2 h-4 w-4" /> Limpar Filtros
        </Button>
      </div>
    </div>
  );
};

export default ColetasFilters;