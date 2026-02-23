import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const LandingHero = () => {
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('empresa')
        .select('logo_sistema_url')
        .single();

      if (error || !data || !data.logo_sistema_url) {
        console.error('Error fetching logo or logo not set:', error);
        setLogoUrl(null); // Set to null if not found
      } else {
        setLogoUrl(data.logo_sistema_url);
      }
      setLoading(false);
    };

    fetchLogo();
  }, []);

  return (
    <main className="flex-grow flex flex-col items-center justify-center text-center p-4 pt-32 pb-16">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="h-[150px] sm:h-[200px] md:h-[300px] lg:h-[500px] flex items-center justify-center px-4"
      >
        {loading ? (
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
        ) : logoUrl ? (
          <img src={logoUrl} alt="Logo RJR Óleo" className="max-h-full max-w-full sm:max-w-md md:max-w-xl lg:max-w-3xl object-contain" />
        ) : (
          <div className="text-center text-white">
            <p className="font-bold text-3xl">RJR ÓLEO</p>
            <p className="text-sm text-emerald-200/80">Logo não configurada</p>
          </div>
        )}
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="text-base sm:text-lg md:text-xl text-emerald-100/80 max-w-xs sm:max-w-md md:max-w-3xl mt-4 px-4"
      >
        A RJR Óleo é uma empresa especializada em coleta de óleo de fritura de origem animal e vegetal com operacaçoes nos estados do Pará, Tocantins e Maranhão.
      </motion.p>
    </main>
  );
};

export default LandingHero;