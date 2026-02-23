import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCnpjCpf, formatCurrency, valorPorExtenso, getMonthsDifference, parseCurrency } from '@/lib/utils';

const ContratoPDF = React.forwardRef(({ contrato, empresa, showSignature }, ref) => {
  const cliente = contrato?.pessoa;

  if (!contrato || !cliente) {
    return <div ref={ref}>Carregando dados do contrato...</div>;
  }

  const formatarDataExtenso = (data) => {
    if (!data) return 'data não especificada';

    let dateObj;
    if (data instanceof Date) {
      dateObj = data;
    } else if (typeof data === 'string') {
      dateObj = parseISO(data);
      if (!isValid(dateObj)) {
        dateObj = new Date(`${data}T00:00:00`);
      }
    } else {
      return 'data inválida';
    }

    if (!isValid(dateObj)) {
      return 'data inválida';
    }

    return format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const renderClausulaValor = () => {
    if (contrato.tipo_coleta === 'Compra') {
      // VALOR DIRETO DO BANCO - JÁ É NÚMERO
      const valorColeta = contrato.valor_coleta || 0;

      const valorFormatado = formatCurrency(valorColeta);
      const valorExtenso = valorPorExtenso(valorColeta);

      return (
        <p className="mb-3 leading-normal text-justify">
          <strong>CLÁUSULA SEGUNDA - DO PREÇO E CONDIÇÕES DE PAGAMENTO</strong>
          <br />
          A <strong>CONTRATADA</strong> pagará à <strong>CONTRATANTE</strong> o valor de {valorFormatado} ({valorExtenso}) por quilograma de resíduo coletado. O pagamento será realizado no ato da coleta.
        </p>
      );
    }
    if (contrato.tipo_coleta === 'Troca') {
      return (
        <p className="mb-3 leading-normal text-justify">
          <strong>CLÁUSULA SEGUNDA - DA TROCA</strong>
          <br />
          A cada {contrato.fator_troca || '____'} kg de óleo coletado, a <strong>CONTRATANTE</strong> receberá 1 (uma) unidade de óleo de soja de 900ml. A entrega do produto será realizada no ato da coleta.
        </p>
      );
    }
    if (contrato.tipo_coleta === 'Doação') {
      return (
        <p className="mb-3 leading-normal text-justify">
          <strong>CLÁUSULA SEGUNDA - DA DOAÇÃO</strong>
          <br />
          A <strong>CONTRATANTE</strong> realizará a doação do resíduo óleo/gordura de origem animal e vegetal utilizado em fritura alimentar à <strong>CONTRATADA</strong>, sem qualquer contrapartida financeira ou material.
        </p>
      );
    }
    return null;
  };

  const contractDurationMonths = getMonthsDifference(contrato.data_inicio, contrato.data_fim);

  // Função simples para converter meses em extenso
  const numeroParaExtensoMeses = (num) => {
    const numeros = [
      'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
      'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte',
      'vinte e um', 'vinte e dois', 'vinte e três', 'vinte e quatro', 'vinte e cinco', 'vinte e seis',
      'vinte e sete', 'vinte e oito', 'vinte e nove', 'trinta', 'trinta e um', 'trinta e dois',
      'trinta e três', 'trinta e quatro', 'trinta e cinco', 'trinta e seis'
    ];
    return num <= 36 ? numeros[num] : num.toString();
  };

  const durationText = numeroParaExtensoMeses(contractDurationMonths);

  return (
    <div
      ref={ref}
      className="bg-white text-black text-xs a4-container"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <div className="p-6 a4-content">
        <header className="flex justify-between items-start mb-4">
          <div className="w-2/5">
            {empresa?.logo_documento_url && (
              <img
                src={empresa.logo_documento_url}
                alt="Logo da Empresa"
                className="h-[88px] mb-1"
              />
            )}
          </div>
          <div className="w-3/5 text-right text-xs leading-tight">
            <p className="font-bold text-sm">
              {empresa?.nome_fantasia && empresa?.razao_social
                ? `${empresa.nome_fantasia} - ${empresa.razao_social}`
                : empresa?.nome_fantasia || empresa?.razao_social || 'Nome Fantasia da Contratada'
              }
            </p>
            <p>CNPJ: {formatCnpjCpf(empresa?.cnpj)}</p>
            <p>{empresa?.endereco}</p>
            <p>{empresa?.municipio} - {empresa?.estado}</p>
            <p>Telefone: {empresa?.telefone} | Email: {empresa?.email}</p>
          </div>
        </header>

        <h1 className="text-center font-bold text-sm mb-3">CONTRATO Nº {contrato.numero_contrato}</h1>
        <p className="mb-3 text-justify leading-normal">
          Pelo presente <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</strong>, de um lado a empresa <strong>{empresa?.nome_fantasia && empresa?.razao_social ? `${empresa.nome_fantasia} - ${empresa.razao_social}` : empresa?.nome_fantasia || empresa?.razao_social || 'Nome Fantasia da Contratada'}</strong>, CNPJ: <strong>{formatCnpjCpf(empresa?.cnpj) || 'CNPJ da Contratada'}</strong>, representada por <strong>{empresa?.razao_social || 'Razão Social da Contratada'}</strong>, doravante denominada <strong>CONTRATADA</strong> e de outro lado a empresa <strong>{cliente.nome_fantasia && cliente.razao_social ? `${cliente.nome_fantasia} - ${cliente.razao_social}` : cliente.nome_fantasia || cliente.razao_social || 'Nome do Cliente'}</strong>, CNPJ: <strong>{formatCnpjCpf(cliente.cnpj_cpf)}</strong>, doravante denominada <strong>CONTRATANTE</strong>.
        </p>
        <h2 className="font-bold text-center mb-3 text-sm">CLÁUSULAS</h2>

        <p className="mb-3 text-justify leading-normal">
          <strong>CLÁUSULA PRIMEIRA - DO OBJETO</strong>
          <br />
          Fica estabelecido que a contratada prestará serviço de coleta dos resíduos óleo/gordura de origem animal e vegetal utilizados em fritura alimentar e fará a troca por óleo de soja novo ou efetuará o pagamento, conforme acordado entre as partes.
          <br />
          <strong>PARÁGRAFO ÚNICO:</strong>
          Podendo haver alterações na compra/troca, dentro do período do contrato, conforme o preço de mercado, desde que ambas as partes estejam de acordo.


        </p>

        {renderClausulaValor()}

        <p className="mb-3 text-justify leading-normal">
          <strong>CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA CONTRATANTE</strong>
          <br />
          A <strong>CONTRATANTE</strong> se compromete a armazenar o resíduo em recipiente apropriado, {contrato.usa_recipiente ? `fornecido pela CONTRATADA em quantidade de ${contrato.qtd_recipiente || '____'} unidade(s),` : 'de sua propriedade,'} e a disponibilizá-lo para coleta na frequência <strong>{contrato.frequencia_coleta || 'a combinar'}</strong>.
          <br />
          {contrato.usa_recipiente && (
            <>
              A contratante fica ciente de que é responsável pelo recipiente e arcará com o extravio enquanto estiver em seu poder.
              <br />
            </>
          )}
          A contratante compromete-se em despejar de forma correta os resíduos conforme orientação da contratada.
          <br />
          A contratante compromete-se em entregar com fidelidade a contratada os resíduos de sua unidade, sem desviar a terceiros.
        </p>

        <p className="mb-3 text-justify leading-normal">
          <strong>CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA</strong>
          <br />
          A <strong>CONTRATADA</strong> se compromete a realizar a coleta do resíduo, fornecer o Certificado de Coleta e dar a destinação final ambientalmente correta, conforme legislação vigente.
          <br />
          A contratada disponibilizará outro recipiente a contratante, sem custo algum, caso haja dano no recipiente de forma que não seja mais possível utilizar.
        </p>

        <p className="mb-3 text-justify leading-normal">
          <strong>CLÁUSULA QUINTA - DO PRAZO</strong>
          <br />
          O presente contrato terá vigência de <strong>{formatarDataExtenso(contrato.data_inicio)}</strong> a <strong>{formatarDataExtenso(contrato.data_fim)}</strong> {contractDurationMonths} ({durationText}) meses, podendo ser renovado mediante acordo entre as partes e ser rescindido, desde que ocorra o aviso prévio de 30 dias.
        </p>

        <p className="mb-3 text-justify leading-normal">
          <strong>CLÁUSULA SEXTA - DO FORO</strong>
          <br />
          Fica eleito o foro da comarca de <strong>{empresa?.municipio || 'Cidade da Empresa'}</strong>, <strong>{empresa?.estado || 'UF'}</strong>, para dirimir quaisquer dúvidas oriundas do presente contrato.
        </p>

        <p className="my-4 text-center leading-normal">
          E por estarem justos e contratados, assinam o presente em duas vias de igual teor e forma.
        </p>

        <p className="text-center mb-6 leading-normal">
          {empresa?.municipio || 'Cidade'} - {empresa?.estado || 'UF'}, {formatarDataExtenso(new Date())}.
        </p>

        <div className="flex justify-around mt-8">
          <div className="w-2/5 text-center">
            {empresa?.assinatura_responsavel_url ? (
              <img src={empresa.assinatura_responsavel_url} alt="Assinatura da Contratada" className="w-48 h-[calc(3.2rem-0.5cm)] border-b-2 border-black mx-auto object-contain" crossOrigin="anonymous" />
            ) : (
              <div className="w-48 h-[calc(3.2rem-0.5cm)] border-b-2 border-black pb-1 mb-1 mx-auto"></div>
            )}
            <p className="font-bold mt-1 text-xs">{empresa?.nome_responsavel_assinatura || empresa?.nome_fantasia || 'CONTRATADA'}</p>
            <p className="text-xs">CONTRATADA</p>
          </div>
          <div className="w-2/5 text-center">
            {showSignature && contrato.assinatura_url ? (
              <img src={contrato.assinatura_url} alt="Assinatura do Cliente" className="w-48 h-[calc(3.2rem-0.5cm)] border-b-2 border-black mx-auto object-contain" crossOrigin="anonymous" />
            ) : (
              <div className="w-48 h-[calc(3.2rem-0.5cm)] border-b-2 border-black pb-1 mb-1 mx-auto"></div>
            )}
            <p className="font-bold mt-1 text-xs">{cliente.nome}</p>
            <p className="text-xs">CONTRATANTE</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .a4-container {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          box-sizing: border-box;
          position: relative;
        }
        
        .a4-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        @media print {
          .a4-container {
            width: 100%;
            height: 100%;
            box-shadow: none;
            margin: 0;
            padding: 0;
          }
          
          body, html {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
          }
        }
      `}</style>
    </div>
  );
});

export default ContratoPDF;