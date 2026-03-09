import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ClientesFilters = ({
    searchTerm,
    updateSearchTerm,
    filterEstado,
    setFilterEstado,
    filterMunicipio,
    setFilterMunicipio,
    estados,
    municipios,
    labels
}) => {
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
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 shadow-xl border border-white/5 relative z-20">
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

            <div className={`${isMobile && !showFilters ? 'hidden' : 'block'} space-y-4`}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50" />
                        <Input
                            type="search"
                            placeholder={`Buscar por nome fantasia, razão social, CNPJ/CPF, município ou estado d${labels.singularArticle} ${labels.singularNoun}...`}
                            value={searchTerm}
                            onChange={(e) => updateSearchTerm(e.target.value)}
                            className="pl-10 w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl h-11 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    <div className="relative">
                        <select
                            className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                            value={filterEstado}
                            onChange={(e) => setFilterEstado(e.target.value)}
                        >
                            <option value="todos" className="bg-slate-900">Estado: Todos ({estados.length})</option>
                            {estados.map(estado => (
                                <option key={estado} value={estado} className="bg-slate-900">{estado}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                    </div>

                    <div className="relative">
                        <select
                            className="w-full h-11 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50"
                            value={filterMunicipio}
                            onChange={(e) => setFilterMunicipio(e.target.value)}
                        >
                            <option value="todos" className="bg-slate-900">Município: Todos ({municipios.length})</option>
                            {municipios.map(muni => (
                                <option key={muni.value} value={muni.value} className="bg-slate-900">{muni.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientesFilters;
