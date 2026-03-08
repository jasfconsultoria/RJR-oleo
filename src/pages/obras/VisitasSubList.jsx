"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, CalendarDays, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const VisitasSubList = ({ obraId }) => {
    const [visitas, setVisitas] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVisitas = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('obras_visitas')
                    .select('*')
                    .eq('obra_id', obraId)
                    .order('data_visita', { ascending: false });

                if (error) throw error;
                setVisitas(data || []);
            } catch (err) {
                console.error('Erro ao carregar sub-lista de visitas:', err);
            } finally {
                setLoading(false);
            }
        };

        if (obraId) fetchVisitas();
    }, [obraId]);

    const getStatusBadge = (status) => {
        switch (status) {
            case 1: return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] py-0">Aguardando</Badge>;
            case 2: return <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] py-0">Concluída</Badge>;
            default: return <Badge variant="secondary" className="text-[10px] py-0">Outro</Badge>;
        }
    };

    if (loading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin w-6 h-6 text-blue-500" /></div>;

    if (visitas.length === 0) {
        return <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-lg">Nenhuma visita registrada para esta obra.</p>;
    }

    return (
        <div className="space-y-2">
            {visitas.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-full">
                            <Clock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {format(new Date(v.data_visita), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                {getStatusBadge(v.status)}
                                <span className="text-[11px] text-slate-500 truncate max-w-[200px]">{v.observacoes || 'Sem observações'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default VisitasSubList;
