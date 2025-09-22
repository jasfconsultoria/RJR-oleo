import React from 'react';
import { Calendar, Search } from 'lucide-react';
// Removido: import ClienteSearchableSelect from '@/components/ui/ClienteSearchableSelect';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const ColetasFilters = ({
  coletaSearchTerm,
  setColetaSearchTerm,
  clientSearchTerm, // Novo prop
  setClientSearchTerm, // Novo prop
  startDate,
  setStartDate,
  endDate,
  setEndDate
}) => {
  const isNumeroColetaSearching = coletaSearchTerm !== '';

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        
        <div>
          <Label htmlFor="numeroColetaSearch" className="block text-white mb-1 text-sm">Nº Coleta</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              id="numeroColetaSearch"
              type="search"
              placeholder="Buscar por número..."
              value={coletaSearchTerm}
              onChange={(e) => setColetaSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
            />
          </div>
        </div>

        <div className="relative z-20">
          <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
            <Input
              id="clientSearch"
              type="search"
              placeholder="Buscar por nome do cliente..."
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60"
              disabled={isNumeroColetaSearching}
            />
          </div>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-10 w-full bg-white/20 border-white/30 text-white rounded-xl"
                disabled={isNumeroColetaSearching}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-10 w-full bg-white/20 border-white/30 text-white rounded-xl"
                disabled={isNumeroColetaSearching}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColetasFilters;