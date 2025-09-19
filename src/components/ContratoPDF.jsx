import React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCnpjCpf, formatCurrency, valorPorExtenso } from '@/lib/utils';

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
      const valorColeta = parseFloat(contrato.valor_coleta);
      const valorFormatado = formatCurrency(valorColeta);
      const valorExtenso = valorPorExtenso(valorColeta);

      return (
        <p className="mb-4">
          <span className="font-bold">CLÁUSULA SEGUNDA - DO PREÇO E CONDIÇÕES DE PAGAMENTO</span>
          <br />
          A <span className="font-bold">CONTRATADA</span> pagará à <span className="font-bold">CONTRATANTE</span> o valor de {valorFormatado} ({valorExtenso}) por quilograma de resíduo coletado. O pagamento será realizado no ato da coleta.
        </p>
      );
    }
    if (contrato.tipo_coleta === 'Troca') {
      return (
        <p className="mb-4">
          <span className="font-bold">CLÁUSULA SEGUNDA - DA TROCA</span>
          <br />
          A cada {contrato.fator_troca || '____'} kg de óleo coletado, a <span className="font-bold">CONTRATANTE</span> receberá 1 (uma) unidade. A entrega do produto será realizada no ato da coleta.
        </p>
      );
    }
    return null;
  };

  return (
    <div 
      ref={ref} 
      className="bg-white text-black text-sm a4-container"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <div className="p-8 a4-content">
        <header className="flex justify-between items-start mb-6">
          <div className="w-2/5">
            {empresa?.logo_documento_url && (
              <img 
                src={empresa.logo_documento_url} 
                alt="Logo da Empresa" 
                className="h-16 mb-2" 
              />
            )}
          </div>
          <div className="w-3/5 text-right">
              <p className="font-bold text-base">{empresa?.nome_fantasia || 'Nome Fantasia da Contratada'}</p>
              <p className="text-xs">{empresa?.endereco}</p>
              <p className="text-xs">CNPJ: {formatCnpjCpf(empresa?.cnpj)}</p>
              <p className="text-xs">Telefone: {empresa?.telefone}</p>
              <p className="text-xs">Email: {empresa?.email}</p>
          </div>
        </header>

        <h1 className="text-center font-bold text-base mb-4">CONTRATO Nº {contrato.numero_contrato}</h1>

        <p className="mb-3 text-justify">
          Pelo presente <span className="font-bold">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</span>, de um lado a empresa <span className="font-bold">{empresa?.nome_fantasia || 'Nome Fantasia da Contratada'}</span>, CNPJ <span className="font-bold">{formatCnpjCpf(empresa?.cnpj) || 'CNPJ da Contratada'}</span>, representada por <span className="font-bold">{empresa?.razao_social || 'Razão Social da Contratada'}</span>, doravante denominada <span className="font-bold">CONTRATADA</span> e de outro lado a empresa <span className="font-bold">{cliente.nome}</span>, CNPJ <span className="font-bold">{formatCnpjCpf(cliente.cnpj_cpf)}</span>, doravante denominada <span className="font-bold">CONTRATANTE</span>.
        </p>

        <h2 className="font-bold text-center mb-3 text-base">CLÁUSULAS</h2>

        <p className="mb-3 text-justify">
          <span className="font-bold">CLÁUSULA PRIMEIRA - DO OBJETO</span>
          <br />
          Fica estabelecido que a contratada prestará serviço de coleta dos resíduos óleo/gordura de origem animal e vegetal utilizados em fritura alimentar e fará a troca por óleo de soja novo ou efetuará o pagamento, conforme acordado entre as partes.
        </p>

        {renderClausulaValor()}

        <p className="mb-3 text-justify">
          <span className="font-bold">CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA CONTRATANTE</span>
          <br />
          A <span className="font-bold">CONTRATANTE</span> se compromete a armazenar o resíduo em recipiente apropriado, {contrato.usa_recipiente ? `fornecido pela CONTRATADA em quantidade de ${contrato.qtd_recipiente || '____'} unidade(s),` : 'de sua propriedade,'} e a disponibilizá-lo para coleta na frequência <span className="font-bold">{contrato.frequencia_coleta || 'a combinar'}</span>.
          <br />
          A contratante fica ciente de que é responsável pelo recipiente e arcará com o extravio enquanto estiver em seu poder.
          <br />
          A contratante compromete-se em despejar de forma correta os resíduos conforme orientação da contratada.
          <br />
          A contratante compromete-se em entregar com fidelidade a contratada os resíduos de sua unidade, sem desviar a terceiros.
        </p>

        <p className="mb-3 text-justify">
          <span className="font-bold">CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA</span>
          <br />
          A <span className="font-bold">CONTRATADA</span> se compromete a realizar a coleta do resíduo, fornecer o Certificado de Coleta e dar a destinação final ambientalmente correta, conforme legislação vigente.
          <br />
          A contratada disponibilizará outro recipiente a contratante, sem custo algum, caso haja dano no recipiente de forma que não seja mais possível utilizar.
        </p>

        <p className="mb-3 text-justify">
          <span className="font-bold">CLÁUSULA QUINTA - DO PRAZO</span>
          <br />
          O presente contrato terá vigência de <span className="font-bold">{formatarDataExtenso(contrato.data_inicio)}</span> a <span className="font-bold">{formatarDataExtenso(contrato.data_fim)}</span> (doze) meses, podendo ser renovado mediante acordo entre as partes e ser rescindido, desde que ocorra o aviso prévio de 30 dias.
        </p>

        <p className="mb-3 text-justify">
          <span className="font-bold">CLÁUSULA SEXTA - DO FORO</span>
          <br />
          Fica eleito o foro da comarca de <span className="font-bold">{empresa?.municipio || 'Cidade da Empresa'}</span>, <span className="font-bold">{empresa?.estado || 'UF'}</span>, para dirimir quaisquer dúvidas oriundas do presente contrato.
        </p>

        <p className="my-6 text-center">
          E por estarem justos e contratados, assinam o presente em duas vias de igual teor e forma.
        </p>

        <p className="text-center mb-8">
          {empresa?.municipio || 'Cidade'}, {formatarDataExtenso(new Date())}.
        </p>

        {showSignature && contrato.assinatura_url ? (
          <div className="flex justify-around mt-10">
            <div className="w-2/5 text-center">
              <div className="border-b-2 border-black pb-1 mb-1"></div>
              <p className="font-bold mt-1 text-xs">{empresa?.nome_fantasia || 'CONTRATADA'}</p>
              <p className="text-xs">CONTRATADA</p>
            </div>
            <div className="w-2/5 text-center">
              <img src={contrato.assinatura_url} alt="Assinatura do Cliente" className="h-20 border-b-2 border-black mx-auto" />
              <p className="font-bold mt-1 text-xs">{cliente.nome}</p>
              <p className="text-xs">CONTRATANTE</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-around mt-10">
            <div className="w-2/5 text-center">
              <div className="border-b-2 border-black pb-1 mb-1"></div>
              <p className="font-bold text-xs">{empresa?.nome_fantasia || '_____________________'}</p>
              <p className="text-xs">CONTRATADA</p>
            </div>
            <div className="w-2/5 text-center">
              <div className="border-b-2 border-black pb-1 mb-1"></div>
              <p className="font-bold text-xs">{cliente.nome}</p>
              <p className="text-xs">CONTRATANTE</p>
            </div>
          </div>
        )}
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