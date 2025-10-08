import React from 'react';
import { Phone, HelpCircle, BookOpen, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingFooter = () => {
  const telefones = [
    { numero: '(63) 99237-8989', regiao: 'Tocantins' },
    { numero: '(94) 99115-8989', regiao: 'Pará' },
    { numero: '(99) 99161-8989', regiao: 'Maranhão' },
  ];

  const getWhatsAppLink = (numero) => {
    const cleanNumber = numero.replace(/\D/g, '');
    return `https://wa.me/55${cleanNumber}`;
  };

  return (
    <footer className="bg-black/20 text-white py-8 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-8">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-yellow-400 mb-2">DISK ÓLEO</h3>
            <div className="flex flex-col md:flex-row gap-x-6 gap-y-2">
              {telefones.map((tel, index) => (
                <a
                  key={index}
                  href={getWhatsAppLink(tel.numero)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center md:justify-start gap-2 text-emerald-200 hover:text-yellow-400 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>{tel.numero} ({tel.regiao})</span>
                </a>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col md:flex-row justify-center md:justify-end items-center gap-6">
            <Link to="/ajuda" className="flex items-center gap-2 text-emerald-200 hover:text-yellow-400 transition-colors">
              <BookOpen className="w-4 h-4" />
              <span>Ajuda</span>
            </Link>
            <Link to="/faq" className="flex items-center gap-2 text-emerald-200 hover:text-yellow-400 transition-colors">
              <HelpCircle className="w-4 h-4" />
              <span>FAQ</span>
            </Link>
            <Link to="/sobre" className="flex items-center gap-2 text-emerald-200 hover:text-yellow-400 transition-colors">
              <Info className="w-4 h-4" />
              <span>Sobre</span>
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} RJR Óleo. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;