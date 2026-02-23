import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateWithTimezone, formatCnpjCpf, formatNumber } from '@/lib/utils';
import { QRCodeSVG as QRCode } from 'qrcode.react';

const CertificadoPDF = ({ data }) => {
  if (!data) return null;

  const { id, cliente, empresa, periodo, totalKg, data_emissao } = data;
  const validationUrl = `${window.location.origin}/certificado/publico/${id}`;

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    return format(new Date(dateTimeString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Helper para formatar o nome do cliente
  const getClientDisplayName = (client) => {
    if (!client) return 'Cliente não especificado';
    // Corrigido para exibir Nome Fantasia - Razão Social, assumindo inversão semântica dos campos no DB
    return client.nome ? `${client.nome} - ${client.nome_fantasia}` : client.nome_fantasia;
  };

  const empresaData = data?.empresa || arguments[0].empresa;

  return (
    <div className="bg-white text-black p-8 font-sans" style={{ width: '297mm', minHeight: '210mm', fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start pb-4 border-b-2 border-gray-300 mb-4">
        <div className="w-2/5">
          {empresaData?.logo_documento_url ? (
            <img src={empresaData.logo_documento_url} alt="Logo da Empresa" className="h-[88px] object-contain" crossOrigin="anonymous" />
          ) : (
            <h1 className="text-sm font-bold">{empresaData?.nome_fantasia || 'Nome da Empresa'}</h1>
          )}
        </div>
        <div className="w-3/5 text-right text-xs leading-tight">
          <p className="font-bold text-sm">
            {empresaData?.nome_fantasia && empresaData?.razao_social
              ? `${empresaData.nome_fantasia} - ${empresaData.razao_social}`
              : empresaData?.nome_fantasia || empresaData?.razao_social || 'Nome da Empresa'
            }
          </p>
          <p>CNPJ: {formatCnpjCpf(empresaData?.cnpj)}</p>
          <p>{empresaData?.endereco}</p>
          <p>{empresaData?.municipio} - {empresaData?.estado}</p>
          <p>Telefone: {empresaData?.telefone} | Email: {empresaData?.email}</p>
        </div>
      </header>

      <main className="mt-12">
        <h1 className="text-2xl font-bold text-center mb-10 tracking-wider">CERTIFICADO DE DESTINAÇÃO – OLEO DE FRITURA USADO</h1>

        <p className="text-lg leading-relaxed text-justify indent-8">
          A empresa <span className="font-bold whitespace-nowrap" style={{ letterSpacing: '0.01em' }}>{empresa?.razao_social || 'Razão Social da Empresa'} – {empresa?.nome_fantasia}</span>, cadastrada sob o CNPJ: <span className="font-bold">{formatCnpjCpf(empresa?.cnpj)}</span>, localizada em <span className="font-bold">{empresa?.endereco}</span>, atuando sob a Licença Ambiental Simplificada (LAS) 53/2023 certifica que a empresa <span className="font-bold">{getClientDisplayName(cliente)}</span>, CNPJ <span className="font-bold">{formatCnpjCpf(cliente?.cnpj_cpf)}</span>, endereço <span className="font-bold">{cliente?.endereco}</span>, telefone <span className="font-bold">{cliente?.telefone}</span>, realizou a entrega do óleo de fritura usado.
        </p>

        <div className="my-8 p-6 bg-gray-100 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-4 text-center">Detalhes da Coleta</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Período da Coleta</p>
              <p className="font-bold text-lg">{formatDateWithTimezone(periodo?.inicio, empresa?.timezone)} - {formatDateWithTimezone(periodo?.fim, empresa?.timezone)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Quantidade Total Coletada</p>
              <p className="font-bold text-lg">{formatNumber(totalKg)} kg</p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold text-center mb-4">DECLARAÇÃO</h2>
          <p className="text-lg leading-relaxed text-justify indent-8">
            Certificamos, para os devidos fins, que os resíduos estavam acondicionados de forma adequada e apropriada para transporte, e que a referida quantidade foi levada a sede, para limpeza e em seguida destinada a indústria, que faz a destinação final ambientalmente adequada, segundo a legislação em vigor.
          </p>
        </div>
      </main>

      <footer className="mt-16">
        <div className="flex justify-between items-end">
          <div className="w-1/3 text-left">
            <div className="flex items-end gap-4">
              {validationUrl && id && (
                <div>
                  <p className="text-xs mb-1">Valide este certificado:</p>
                  <QRCode value={validationUrl} size={80} level={"H"} includeMargin={true} />
                </div>
              )}
              <div className="text-xs text-gray-500">
                <p>ID do Certificado:</p>
                <p className="font-mono break-words">{id}</p>
              </div>
            </div>
          </div>

          <div className="w-1/3 text-center">
            {empresa?.assinatura_responsavel_url ? (
              <img src={empresa.assinatura_responsavel_url} alt="Assinatura do Responsável" className="h-20 border-b-2 border-gray-400 mx-auto" crossOrigin="anonymous" />
            ) : (
              <div className="border-t-2 border-gray-400 pt-2 px-12 font-bold" style={{ letterSpacing: '0.025em' }}></div>
            )}
            <p className="font-bold mt-1 text-xs">{empresa?.nome_responsavel_assinatura || empresa?.nome_fantasia}</p>
            <p className="text-sm">Assinatura do Responsável</p>
          </div>

          <div className="w-1/3"></div>
        </div>
        <p className="text-sm text-gray-500 mt-8 text-center">
          Data de Emissão: {formatDateTime(data_emissao)}
        </p>
      </footer>
    </div>
  );
};

export default CertificadoPDF;