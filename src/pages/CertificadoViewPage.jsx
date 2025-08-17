import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';

const CertificadoViewPage = () => {
  const [searchParams] = useSearchParams();
  const [htmlContent, setHtmlContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const data = searchParams.get('data');
    if (data) {
      try {
        const decodedHtml = atob(data);
        setHtmlContent(decodedHtml);
      } catch (e) {
        setError('Falha ao decodificar os dados do certificado. O link pode estar corrompido.');
      }
    } else {
      setError('Nenhum dado de certificado encontrado no link.');
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-red-600 p-4">
        <p>{error}</p>
      </div>
    );
  }

  if (!htmlContent) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Visualização de Certificado</title>
      </Helmet>
      <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </>
  );
};

export default CertificadoViewPage;