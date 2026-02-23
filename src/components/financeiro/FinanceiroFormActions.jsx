import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const FinanceiroFormActions = ({ onBackPath, isSaving, isEditing }) => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-between items-center pt-6">
      <Button type="button" onClick={() => navigate(onBackPath)} variant="outline" className="rounded-xl">
        <ArrowLeft className="w-5 h-5 mr-2" />
        Voltar
      </Button>
      <Button type="submit" disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
        {isSaving ? 'Salvando...' : (isEditing ? 'Salvar Alterações' : 'Salvar')}
      </Button>
    </div>
  );
};