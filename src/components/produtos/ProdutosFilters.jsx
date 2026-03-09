import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ProdutosFilters = ({
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    activeFilter,
    setActiveFilter,
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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div>
                        <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="searchTerm"
                                type="search"
                                placeholder="Nome ou código do produto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="typeFilter" className="block text-white mb-1 text-sm">Tipo</Label>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                                <SelectValue placeholder="Todos os Tipos" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="coletado">Coletado</SelectItem>
                                <SelectItem value="novo">Novo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="activeFilter" className="block text-white mb-1 text-sm">Status</Label>
                        <Select value={activeFilter} onValueChange={setActiveFilter}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                                <SelectValue placeholder="Todos os Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="true">Ativo</SelectItem>
                                <SelectItem value="false">Inativo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default ProdutosFilters;
