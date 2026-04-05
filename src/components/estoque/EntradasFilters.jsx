import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { format, parseISO, isValid } from 'date-fns';

const EntradasFilters = ({
    searchTerm,
    setSearchTerm,
    productSearchTerm,
    setProductSearchTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
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
            className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 relative z-10"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar Documento</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="searchTerm"
                                type="search"
                                placeholder="Nº Documento, observação..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="productSearchTerm" className="block text-white mb-1 text-sm">Buscar Produto</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="productSearchTerm"
                                type="search"
                                placeholder="Nome, código do produto..."
                                value={productSearchTerm}
                                onChange={(e) => setProductSearchTerm(e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 col-span-2">
                        <div>
                            <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
                            <input
                                type="date"
                                id="startDate"
                                className="flex ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                                value={startDate ? (startDate instanceof Date ? format(startDate, 'yyyy-MM-dd') : startDate) : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        const date = parseISO(val);
                                        if (isValid(date)) setStartDate(date);
                                    } else {
                                        setStartDate(null);
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
                            <input
                                type="date"
                                id="endDate"
                                className="flex ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                                value={endDate ? (endDate instanceof Date ? format(endDate, 'yyyy-MM-dd') : endDate) : ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val) {
                                        const date = parseISO(val);
                                        if (isValid(date)) setEndDate(date);
                                    } else {
                                        setEndDate(null);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default EntradasFilters;
