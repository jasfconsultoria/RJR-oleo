import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const FaqPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const faqItems = [
    {
      question: 'Como eu cadastro um novo cliente?',
      answer: 'Vá para a seção "Clientes" no menu lateral, clique no botão "Novo Cliente" e preencha as informações solicitadas. Lembre-se de salvar ao final.',
    },
    {
      question: 'É possível editar uma coleta já lançada?',
      answer: 'Sim. Na tela "Lista de Coletas", encontre a coleta que deseja alterar e clique no ícone de lápis (Editar) na coluna "Ações".',
    },
    {
      question: 'Como gero um certificado para um cliente?',
      answer: 'Acesse a seção "Certificados", clique em "Novo Certificado", selecione o cliente e o período desejado. O sistema irá calcular o total de massa coletada e gerar o documento em PDF.',
    },
    {
      question: 'O que significa o status "Vencido" em um contrato?',
      answer: 'O status "Vencido" indica que a data final do contrato já passou. É um lembrete para que você entre em contato com o cliente para uma possível renovação.',
    },
    {
      question: 'Posso exportar os dados dos relatórios?',
      answer: 'Sim! Na página de "Relatórios", após aplicar os filtros desejados, clique no botão "Exportar" no canto superior direito para baixar uma planilha em Excel com os dados.',
    },
    {
      question: 'Qual a diferença entre coleta do tipo "Compra" e "Troca"?',
      answer: '"Compra" é quando você paga em dinheiro pelo óleo coletado. "Troca" é quando você fornece produtos (como óleo novo) em troca do óleo usado.',
    },
  ];

  return (
    <>
      <Helmet>
        <title>FAQ - Perguntas Frequentes - RJR Óleo</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 text-white p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8 max-w-4xl mx-auto"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <HelpCircle className="w-8 h-8 text-emerald-400" /> Perguntas Frequentes (FAQ)
              </h1>
              <p className="text-emerald-200/80 mt-2">
                Tire suas dúvidas sobre as funcionalidades do sistema.
              </p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-sm border-white/20 rounded-xl p-6 shadow-lg"
          >
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-b-white/10 last:border-b-0">
                  <AccordionTrigger className="text-left text-emerald-300 hover:no-underline text-lg">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-white/80 text-base pt-2">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
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

export default FaqPage;