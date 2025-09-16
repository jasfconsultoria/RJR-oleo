import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';

const RelatorioFinanceiroPage = () => {
  return (
    <>
      <Helmet><title>Relatório Financeiro - RJR Óleo</title></Helmet>
      <div className="animate-fade-in space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="w-8 h-8 text-emerald-400" />
          Relatório Financeiro
        </h1>
        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl">
          <CardHeader>
            <CardTitle>Em Desenvolvimento</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Esta página de relatório financeiro está em construção.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default RelatorioFinanceiroPage;