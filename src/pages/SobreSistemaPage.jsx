import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Users, Info, ArrowLeft, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const SobreSistemaPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Helmet>
        <title>Sobre o Sistema - RJR Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto space-y-8 pt-8 pb-8 px-4 sm:px-6 lg:px-8 min-h-screen"
      >
        <div className="relative flex justify-between items-start mb-8">
          <div className="text-left">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Info className="w-8 h-8 text-emerald-400" />
              Sobre o Sistema de Gestão RJR Óleo
            </h1>
            <p className="mt-2 text-lg text-emerald-200/80">
              Uma solução moderna e eficiente para o gerenciamento de coletas.
            </p>
          </div>
        </div>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl text-emerald-300">
              <Users className="w-8 h-8" />
              Idealizado por JASF Consultoria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-white/90">
            <p>
              Este sistema foi concebido e orientado pela <strong>JASF Consultoria</strong>. A visão estratégica e o profundo conhecimento do negócio foram cruciais para transformar desafios complexos em uma solução tecnológica intuitiva e robusta.
            </p>
            <p>
              A colaboração foi a chave do sucesso, com a JASF Consultoria definindo os requisitos, validando as funcionalidades e garantindo que o produto final atendesse perfeitamente às necessidades do mercado.
            </p>
             <div className="flex items-center gap-3 pt-2">
                <Phone className="w-5 h-5 text-emerald-400" />
                <a href="https://wa.me/5563984091890" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-300 transition-colors">
                  (63) 98409-1890
                </a>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl text-emerald-300">
              <Zap className="w-8 h-8 text-yellow-400" />
              Desenvolvido com Hostinger Horizons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-white/90">
            <p>
              A construção da plataforma foi realizada em parceria com a <strong>Hostinger Horizons</strong>, uma plataforma de desenvolvimento de software assistida por IA.
            </p>
            <p>
              Seguindo a orientação e a expertise da JASF Consultoria, a tecnologia da Horizons permitiu acelerar o ciclo de desenvolvimento, garantindo um código limpo e performático. Esta sinergia foi fundamental para materializar a visão do projeto com agilidade e qualidade técnica.
            </p>
          </CardContent>
        </Card>

        <div className="pt-6">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              className="bg-transparent text-white border-gray-400 hover:bg-gray-700 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </div>

        <div className="text-center text-sm text-gray-400 pt-4">
          <p>JASF Consultoria & Hostinger Horizons - Inovação e tecnologia para o seu negócio.</p>
        </div>
      </motion.div>
    </>
  );
};

export default SobreSistemaPage;