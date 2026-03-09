import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion } from 'framer-motion';

const RecibosFilters = ({
    searchTerm,
    setSearchTerm,
    tipoFilter,
    setTipoFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate
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
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 shadow-xl border border-white/5 relative z-10"
        >
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
                    <div>
                        <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
                        <input
                            id="searchTerm"
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Nome, número ou descrição..."
                            className="w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                    <div>
                        <Label htmlFor="tipoFilter" className="block text-white mb-1 text-sm">Tipo</Label>
                        <Select value={tipoFilter} onValueChange={setTipoFilter}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                                <SelectValue placeholder="Todos os Tipos" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="cliente">Cliente</SelectItem>
                                <SelectItem value="fornecedor">Fornecedor</SelectItem>
                                <SelectItem value="coletor">Coletor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Inicial</Label>
                        <input
                            id="startDate"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-white/20 border-white/30 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                    <div>
                        <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Final</Label>
                        <input
                            id="endDate"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-white/20 border-white/30 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default RecibosFilters;
