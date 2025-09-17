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
          <strong>CLÁUSULA SEGUNDA - DO PREÇO E CONDIÇÕES DE PAGAMENTO</strong>
          <br />
          A <strong>CONTRATADA</strong> pagará à <strong>CONTRATANTE</strong> o valor de {valorFormatado} ({valorExtenso}) por quilograma de resíduo coletado. O pagamento será realizado no ato da coleta.
        </p>
      );
    }
    if (contrato.tipo_coleta === 'Troca') {
      return (
        <p className="mb-4">
          <strong>CLÁUSULA SEGUNDA - DA TROCA</strong>
          <br />
          A cada {contrato.fator_troca || '____'} kg de óleo coletado, a <strong>CONTRATANTE</strong> receberá 1 (uma) unidade de óleo de soja novo. A entrega do produto será realizada no ato da coleta.
        </p>
      );
    }
    return null;
  };

  return (
    <div ref={ref} className="p-8 bg-white text-black text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
      <header className="flex justify-between items-start mb-8">
        <div className="w-1/2">
          {empresa?.logo_documento_url && (
            <img src={empresa.logo_documento_url} alt="Logo da Empresa" className="h-20 mb-4" />
          )}
        </div>
        <div className="w-1/2 text-right">
            <p className="font-bold text-lg" style={{ letterSpacing: '0.025em' }}>{empresa?.nome_fantasia || 'Nome da Empresa Contratada'}</p>
            <p>{empresa?.endereco}</p>
            <p>CNPJ: {formatCnpjCpf(empresa?.cnpj)}</p>
            <p>Telefone: {empresa?.telefone}</p>
            <p>Email: {empresa?.email}</p>
        </div>
      </header>

      <h1 className="text-center font-bold text-lg mb-6">CONTRATO Nº {contrato.numero_contrato}</h1>

      <p className="mb-4">
        Pelo presente <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</strong>, de um lado a empresa <strong>{empresa?.nome_fantasia || 'Nome da Empresa Contratada'}</strong>, CNPJ <strong>{formatCnpjCpf(empresa?.cnpj) || 'CNPJ da Contratada'}</strong>, representada por <strong>{empresa?.razao_social || 'Representante da Contratada'}</strong>, doravante denominada <strong>CONTRATADA</strong> e de outro lado a empresa <strong>{cliente.nome}</strong>, CNPJ <strong>{formatCnpjCpf(cliente.cnpj_cpf)}</strong>, doravante denominada <strong>CONTRATANTE</strong>.
      </p>

      <h2 className="font-bold text-center mb-4">CLÁUSULAS</h2>

      <p className="mb-4">
        <strong>CLÁUSULA PRIMEIRA - DO OBJETO</strong>
        <br />
        Fica estabelecido que a contratada prestará serviço de coleta dos resíduos óleo/gordura de origem animal e vegetal utilizados em fritura alimentar e fará a troca por óleo de soja novo ou efetuará o pagamento, conforme acordado entre as partes.
      </p>

      {renderClausulaValor()}

      <div className="mb-4">
        <strong>CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES DA CONTRATANTE</strong>
        <p className="mt-2">
          3.1. A <strong>CONTRATANTE</strong> se compromete a armazenar o resíduo em recipiente apropriado, {contrato.usa_recipiente ? `fornecido pela CONTRATADA em quantidade de ${contrato.qtd_recipiente || '____'} unidade(s),` : 'de sua propriedade,'} e a disponibilizá-lo para coleta na frequência <strong>{contrato.frequencia_coleta || 'a combinar'}</strong>.
        </p>
        <p className="mt-2">
          3.2. A contratante fica ciente de que é responsável pelo recipiente e arcará com o extravio enquanto estiver em seu poder.
        </p>
        <p className="mt-2">
          3.3. A contratante compromete-se em despejar de forma correta os resíduos conforme orientação da contratada.
        </p>
        <p className="mt-2">
          3.4. A contratante compromete-se em entregar com fidelidade a contratada os resíduos de sua unidade, sem desviar a terceiros.
        </p>
      </div>

      <div className="mb-4">
        <strong>CLÁUSULA QUARTA - DAS OBRIGAÇÕES DA CONTRATADA</strong>
        <p className="mt-2">
          4.1. A <strong>CONTRATADA</strong> se compromete a realizar a coleta do resíduo, fornecer o Certificado de Coleta e dar a destinação final ambientalmente correta, conforme legislação vigente.
        </p>
        <p className="mt-2">
          4.2. A contratada disponibilizará outro recipiente a contratante, sem custo algum, caso haja dano no recipiente de forma que não seja mais possível utilizar.
        </p>
      </div>

      <p className="mb-4">
        <strong>CLÁUSULA QUINTA - DO PRAZO</strong>
        <br />
        O presente contrato terá vigência de <strong>{formatarDataExtenso(contrato.data_inicio)}</strong> a <strong>{formatarDataExtenso(contrato.data_fim)}</strong> (12 (doze) meses), podendo ser renovado mediante acordo entre as partes e ser rescindido, desde que ocorra o aviso prévio de 30 dias.
      </p>

      <p className="mb-4">
        <strong>CLÁUSULA SEXTA - DO FORO</strong>
        <br />
        Fica eleito o foro da comarca de <strong>{empresa?.municipio || 'Cidade da Empresa'}</strong>, <strong>{empresa?.estado || 'UF'}</strong>, para dirimir quaisquer dúvidas oriundas do presente contrato.
      </p>

      <p className="my-8 text-center">
        E por estarem justos e contratados, assinam o presente em duas vias de igual teor e forma.
      </p>

      <p className="text-center mb-12">
        {empresa?.municipio || 'Cidade'}, {formatarDataExtenso(new Date())}.
      </p>

      {showSignature && contrato.assinatura_url ? (
        <div className="flex flex-col items-center justify-center mt-8">
          <img src={contrato.assinatura_url} alt="Assinatura do Cliente" className="h-24 border-b-2 border-black" />
          <p className="text-center font-bold">{cliente.nome}</p>
          <p className="text-center">CONTRATANTE</p>
        </div>
      ) : (
        <div className="flex justify-around mt-16">
          <div className="w-2/5 text-center">
            <div className="border-b-2 border-black pb-1"></div>
            <p className="mt-2 font-bold" style={{ letterSpacing: '0.025em' }}>{empresa?.nome_fantasia || '_____________________'}</p>
            <p>CONTRATADA</p>
          </div>
          <div className="w-2/5 text-center">
            <div className="border-b-2 border-black pb-1"></div>
            <p className="mt-2 font-bold">{cliente.nome}</p>
            <p>CONTRATANTE</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default ContratoPDF;