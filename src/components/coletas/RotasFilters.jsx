import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const RotasFilters = ({
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    filterCollector,
    setFilterCollector,
    searchTerm,
    setSearchTerm,
    collectors,
    role,
}) => {
    const [showFilters, setShowFilters] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

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
            className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-4 relative z-10"
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
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Data Inicial</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-black/20 border-white/10 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Data Final</Label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-black/20 border-white/10 text-white"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Coletor</Label>
                        <select
                            className="w-full h-10 bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                            value={role === 'coletor' ? 'loading' : filterCollector} // Simplified logic for the component
                            onChange={(e) => setFilterCollector(e.target.value)}
                            disabled={role === 'coletor'}
                        >
                            <option value="todos" className="bg-slate-900">Todos</option>
                            {collectors.map(col => (
                                <option key={col.id} value={col.id} className="bg-slate-900">{col.full_name || 'Sem Nome'}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs text-slate-400">Buscar Cliente</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Nome do cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-black/20 border-white/10 text-white"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default RotasFilters;
