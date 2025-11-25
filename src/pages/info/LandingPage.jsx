import React from 'react';
import { Helmet } from 'react-helmet';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingHero from '@/components/landing/LandingHero';
import LandingFooter from '@/components/landing/LandingFooter';

const LandingPage = () => {
  return (
    <>
      <Helmet>
        <title>RJR Óleo - Coleta de Óleo de Fritura</title>
        <meta name="description" content="A RJR Óleo é uma empresa especializada em coleta de óleo de fritura de origem animal e vegetal com operacaçoes nos estados do Pará, Tocantins e Maranhão." />
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex flex-col">
        <LandingHeader />
        <main className="flex-grow flex items-center justify-center">
          <LandingHero />
        </main>
        <LandingFooter />
      </div>
    </>
  );
};

export default LandingPage;