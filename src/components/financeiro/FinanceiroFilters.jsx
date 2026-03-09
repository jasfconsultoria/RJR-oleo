import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';

const FinanceiroFilters = ({
    searchTerm,
    setSearchTerm,
    clientSearchTerm,
    setClientSearchTerm,
    statusFilter,
    setStatusFilter,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    entityLabel
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
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-6 space-y-4 shadow-xl border border-white/5 relative z-10">
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
                        <Label htmlFor="searchTerm" className="block text-white mb-1 text-sm">Buscar</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="searchTerm"
                                type="search"
                                placeholder="Nº Doc, descrição..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="clientSearch" className="block text-white mb-1 text-sm">{entityLabel}</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70" />
                            <Input
                                id="clientSearch"
                                type="search"
                                placeholder={`Buscar por nome d${entityLabel.toLowerCase()}...`}
                                value={clientSearchTerm}
                                onChange={(e) => setClientSearchTerm(e.target.value)}
                                className="pl-10 w-full bg-white/20 border-white/30 text-white placeholder:text-white/60 rounded-xl"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="statusFilter" className="block text-white mb-1 text-sm">Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="bg-white/20 border-white/30 text-white rounded-xl">
                                <SelectValue placeholder="Todos os Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 text-white border-gray-700 rounded-xl">
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="partially_paid">Parcialmente Pago</SelectItem>
                                <SelectItem value="paid">Quitado</SelectItem>
                                <SelectItem value="overdue">Vencido</SelectItem>
                                <SelectItem value="canceled">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="startDate" className="block text-white mb-1 text-sm">Venc. Início</Label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setStartDate(e.target.value ? parseISO(e.target.value) : null)}
                                className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                            />
                        </div>
                        <div>
                            <Label htmlFor="endDate" className="block text-white mb-1 text-sm">Venc. Fim</Label>
                            <input
                                type="date"
                                id="endDate"
                                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setEndDate(e.target.value ? parseISO(e.target.value) : null)}
                                className="w-full bg-white/20 border border-white/30 text-white rounded-xl px-3 py-2 h-10 focus:outline-none focus:ring-2 focus:ring-emerald-400 text-sm"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinanceiroFilters;
