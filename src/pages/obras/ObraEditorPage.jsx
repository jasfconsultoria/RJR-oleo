import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ObraForm from './components/ObraForm';

const ObraEditorPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/app/obras')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text">{id ? 'Editar Obra' : 'Nova Obra'}</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm sm:text-base">Gerencie os dados da obra / centro de custo.</p>
                </div>
            </div>

            <div className="config-card max-w-5xl mx-auto p-4 sm:p-6">
                <ObraForm
                    id={id}
                    onSaveSuccess={() => navigate('/app/obras')}
                    onCancel={() => navigate('/app/obras')}
                />
            </div>
        </div>
    );
};

export default ObraEditorPage;
