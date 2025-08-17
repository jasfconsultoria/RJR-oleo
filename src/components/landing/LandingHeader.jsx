import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

const LandingHeader = () => {
  return (
    <header className="absolute top-0 left-0 right-0 p-4 z-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto flex justify-end items-center"
      >
        <Button asChild className="bg-yellow-400 text-emerald-900 font-bold hover:bg-yellow-500 transition-colors shadow-lg rounded-xl">
          <Link to="/app/login">
            <LogIn className="mr-2 h-4 w-4" />
            Acessar Sistema
          </Link>
        </Button>
      </motion.div>
    </header>
  );
};

export default LandingHeader;