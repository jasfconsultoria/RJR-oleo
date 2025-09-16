import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CertificadoPDF = ({ data }) => {
  if (!data) return null;

  const { cliente, empresa, periodo, totalKg, data_emissao } = data;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
  };
  
  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    return format(new Date(dateTimeString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);
  };

  return (
    <div className="bg-white text-black p-8 font-sans" style={{ width: '210mm', minHeight: '297mm', fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
        <div>
          {empresa?.logo_documento_url ? (
            <img src={empresa.logo_documento_url} alt="Logo da Empresa" className="h-28 object-contain" crossOrigin="anonymous" />
          ) : (
            <h1 className="text-2xl font-bold">{empresa?.nome_fantasia || 'Nome da Empresa'}</h1>
          )}
        </div>
        <div className="text-right text-sm">
          <p className="font-bold">{empresa?.razao_social}</p>
          <p>{empresa?.endereco}</p>
          <p>CNPJ: {empresa?.cnpj}</p>
          <p>Telefone: {empresa?.telefone}</p>
          <p>Email: {empresa?.email}</p>
        </div>
      </header>

      <main className="mt-12">
        <h1 className="text-2xl font-bold text-center mb-10">CERTIFICADO DE DESTINAÇÃO CORRETA DE ÓLEO</h1>

        <p className="text-lg leading-relaxed text-justify indent-8">
          Certificamos que a empresa <span className="font-bold">{cliente?.nome}</span>,
          inscrita no CNPJ/CPF sob o nº <span className="font-bold">{cliente?.cnpj_cpf}</span>,
          localizada em <span className="font-bold">{cliente?.endereco}, {cliente?.municipio} - {cliente?.estado}</span>,
          realizou a entrega voluntária de resíduos de óleo de cozinha usado, contribuindo para a preservação do meio ambiente.
        </p>

        <div className="my-8 p-6 bg-gray-100 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-center">Detalhes da Coleta</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Período da Coleta</p>
              <p className="font-bold text-lg">{formatDate(periodo?.inicio)} - {formatDate(periodo?.fim)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Quantidade Total Coletada</p>
              <p className="font-bold text-lg">{formatNumber(totalKg)} kg</p>
            </div>
          </div>
        </div>

        <p className="text-lg leading-relaxed text-justify indent-8">
          A quantidade de resíduo mencionada foi coletada e destinada corretamente pela nossa empresa,
          seguindo todas as normas ambientais vigentes para o reprocessamento e reciclagem do material,
          evitando o descarte inadequado e seus impactos negativos na natureza.
        </p>
      </main>

      <footer className="mt-24 text-center">
        <div className="inline-block">
          <p className="border-t-2 border-gray-400 pt-2 px-12 font-bold">{empresa?.nome_fantasia}</p>
          <p className="text-sm">Assinatura do Responsável</p>
        </div>
        <p className="text-sm text-gray-500 mt-8">
          Data de Emissão: {formatDateTime(data_emissao)}
        </p>
      </footer>
    </div>
  );
};

export default CertificadoPDF;