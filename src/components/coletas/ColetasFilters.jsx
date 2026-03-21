import React, { useState, useEffect } from 'react';
import { Calendar, Search, Filter } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ColetasFilters = ({
  coletaSearchTerm,
  setColetaSearchTerm,
  clientSearchTerm,
  setClientSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  tipoColeta,
  setTipoColeta
}) => {
  const isNumeroColetaSearching = coletaSearchTerm !== '';
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-20">
      {/* Header com botão de mostrar/ocultar no mobile */}
      <div className="flex justify-between items-center mb-4 md:hidden">
        <h3 className="text-emerald-300 text-lg flex items-center gap-2">
          <Filter className="h-5 w-5" /> Filtros
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 border-white/30 text-white hover:bg-white/10"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Ocultar' : 'Mostrar'}
        </Button>
      </div>

      <div className={`${isMobile && !showFilters ? 'hidden' : 'block'}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">

          <div className="lg:col-span-2">
            <Label htmlFor="numeroColetaSearch" className="block text-white mb-1 text-sm">Nº Coleta</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
              <Input
                id="numeroColetaSearch"
                type="search"
                placeholder="Buscar..."
                value={coletaSearchTerm || ''}
                onChange={(e) => setColetaSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 text-sm"
              />
            </div>
          </div>

          <div className="relative z-20 lg:col-span-4">
            <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
              <Input
                id="clientSearch"
                type="search"
                placeholder="Nome..."
                value={clientSearchTerm || ''}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 text-sm"
                disabled={isNumeroColetaSearching}
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="tipoFilter" className="block text-white mb-1 text-sm">Tipo</Label>
            <Select
              value={tipoColeta || 'Todas'}
              onValueChange={(value) => setTipoColeta(value === 'Todas' ? '' : value)}
              disabled={isNumeroColetaSearching}
            >
              <SelectTrigger 
                id="tipoFilter"
                className="bg-white/20 border-white/30 text-white rounded-xl focus:ring-emerald-400"
              >
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-emerald-900 border-white/20 text-white">
                <SelectItem value="Todas">Todas</SelectItem>
                <SelectItem value="Compra">Compra</SelectItem>
                <SelectItem value="Troca">Troca</SelectItem>
                <SelectItem value="Doação">Doação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Datas ocupam 2 colunas cada */}
          <div className="lg:col-span-2">
            <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate || ''}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              disabled={isNumeroColetaSearching}
            />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate || ''}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
              disabled={isNumeroColetaSearching}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColetasFilters;