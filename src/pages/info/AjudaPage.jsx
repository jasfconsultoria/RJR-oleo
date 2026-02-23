import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { BookOpen, BarChart2, Users, FileText, ClipboardList, Package, UserCog, Building, AlertCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ManualItem = ({ icon, title, description, isAdmin }) => (
  <motion.div
    whileHover={{ y: -5, scale: 1.02 }}
    className="h-full"
  >
    <Card className="bg-white/10 backdrop-blur-sm border-white/10 text-white h-full rounded-xl shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-3">
          {icon}
          <CardTitle className="text-emerald-300">{title}</CardTitle>
          {isAdmin && (
            <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full">
              Admin
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-white/80">{description}</CardDescription>
      </CardContent>
    </Card>
  </motion.div>
);

const AjudaPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const manualItems = [
    {
      icon: <BarChart2 className="w-6 h-6 text-emerald-400" />,
      title: 'Dashboard',
      description: 'A tela principal do sistema. Aqui você tem uma visão geral das coletas e da massa total coletada. Os dados podem ser visualizados por estado (para administradores) ou por município (para coletores).',
    },
    {
      icon: <Users className="w-6 h-6 text-emerald-400" />,
      title: 'Clientes',
      description: 'Nesta seção, você pode cadastrar, editar, visualizar e excluir clientes. A busca permite encontrar clientes rapidamente por nome, CNPJ/CPF ou localização.',
    },
    {
      icon: <Package className="w-6 h-6 text-emerald-400" />,
      title: 'Coletas',
      description: 'Registre todas as coletas de óleo. Você pode filtrar por período e cliente, além de editar ou excluir um lançamento. Para cada coleta, é possível gerar um recibo.',
    },
    {
      icon: <FileText className="w-6 h-6 text-emerald-400" />,
      title: 'Certificados',
      description: 'Gere certificados de destinação correta para seus clientes. Os certificados são baseados nas coletas de um período e podem ser exportados em PDF.',
    },
    {
      icon: <ClipboardList className="w-6 h-6 text-emerald-400" />,
      title: 'Contratos',
      description: 'Gerencie os contratos com seus clientes. Cadastre novos contratos, defina datas, status e visualize os detalhes. Os contratos também podem ser impressos.',
    },
    {
      icon: <BarChart2 className="w-6 h-6 text-emerald-400" />,
      title: 'Relatórios',
      description: 'Analise os dados de coletas com filtros avançados por período, local, cliente e usuário. Os dados podem ser exportados para o Excel para uma análise mais detalhada.',
    },
    {
      icon: <UserCog className="w-6 h-6 text-emerald-400" />,
      title: 'Usuários',
      description: 'Seção para administradores gerenciarem os usuários do sistema. É possível convidar novos usuários (administradores ou coletores) e definir suas permissões.',
      isAdmin: true,
    },
    {
      icon: <Building className="w-6 h-6 text-emerald-400" />,
      title: 'Empresa',
      description: 'Aqui, o administrador pode configurar os dados da empresa, como nome, CNPJ, endereço e logo. Essas informações são usadas nos documentos gerados pelo sistema, como recibos e certificados.',
      isAdmin: true,
    },
    {
      icon: <AlertCircle className="w-6 h-6 text-emerald-400" />,
      title: 'FAQ',
      description: 'Tem alguma dúvida rápida? Consulte nossa seção de Perguntas Frequentes (FAQ) para encontrar respostas para os questionamentos mais comuns sobre o uso do sistema.',
    },
  ];

  return (
    <>
      <Helmet>
        <title>Manual do Sistema - RJR Óleo</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 text-white p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 max-w-7xl mx-auto"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-emerald-400" /> Manual do Sistema
              </h1>
              <p className="text-emerald-200/80 mt-2">
                Encontre aqui as principais informações sobre como utilizar o sistema.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {manualItems.map((item, index) => (
              <ManualItem key={index} {...item} />
            ))}
          </div>

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
        </motion.div>
      </div>
    </>
  );
};

export default AjudaPage;