import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

const PlaceholderPage = ({ title }) => {
  return (
    <>
      <Helmet>
        <title>{title} - Sistema de Coleta de Óleo</title>
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center h-full text-center text-white"
      >
        <Construction className="w-24 h-24 text-yellow-400 mb-6" />
        <h1 className="text-4xl font-bold mb-2">{title}</h1>
        <p className="text-lg text-emerald-200">Esta funcionalidade está em construção.</p>
        <p className="text-md text-emerald-300 mt-1">Volte em breve para conferir as novidades!</p>
      </motion.div>
    </>
  );
};

export default PlaceholderPage;