import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import ProdutoSearchableSelect from '@/components/produtos/ProdutoSearchableSelect';

const MovimentacoesFilters = ({
    filters,
    handleFilterChange,
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
                {/* Primeira linha de filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    {/* Buscar */}
                    <div className="lg:col-span-1">
                        <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="searchTerm"
                                type="search"
                                placeholder="Nº Doc, Observação..."
                                value={filters.searchTerm}
                                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Cliente */}
                    <div className="lg:col-span-2">
                        <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">Cliente</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="clientSearch"
                                type="search"
                                placeholder="Buscar por nome fantasia ou razão social..."
                                value={filters.clientSearchTerm}
                                onChange={(e) => handleFilterChange('clientSearchTerm', e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Produto */}
                    <div className="lg:col-span-1">
                        <ProdutoSearchableSelect
                            labelText="Produto"
                            value={filters.selectedProdutoId}
                            onChange={(product) => handleFilterChange('selectedProdutoId', product ? product.id : null)}
                        />
                    </div>

                    {/* Tipo */}
                    <div className="lg:col-span-1">
                        <Label htmlFor="type" className="block text-white mb-1 text-sm">Tipo</Label>
                        <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="entrada">Entrada</SelectItem>
                                <SelectItem value="saida">Saída</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Segunda linha de filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    {/* Data Início */}
                    <div className="lg:col-span-1">
                        <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Data Início</Label>
                        <DatePicker
                            date={filters.startDate}
                            setDate={(date) => handleFilterChange('startDate', date)}
                            className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                        />
                    </div>

                    {/* Data Fim */}
                    <div className="lg:col-span-1">
                        <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Data Fim</Label>
                        <DatePicker
                            date={filters.endDate}
                            setDate={(date) => handleFilterChange('endDate', date)}
                            className="w-full bg-white/20 border-white/30 text-white rounded-xl"
                        />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default MovimentacoesFilters;
