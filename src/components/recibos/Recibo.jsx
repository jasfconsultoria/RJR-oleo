// VERSÃO COMPLETA E DEFINITIVAMENTE CORRIGIDA DO Recibo.jsx
import React, { useState, useEffect } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, parseCurrency, formatCnpjCpf } from '@/lib/utils';
import { utcToZonedTime } from 'date-fns-tz';

const formatDisplayDate = (dateInput, timezone) => {
    if (!dateInput) {
        return 'N/A';
    }

    let baseDate;
    if (dateInput instanceof Date) {
        baseDate = dateInput;
    } else if (typeof dateInput === 'string') {
        const parsedDate = parseISO(dateInput);
        if (!isValid(parsedDate)) {
            console.error("Recibo.jsx - Invalid date string provided:", dateInput);
            return 'Data inválida';
        }
        baseDate = parsedDate;
    } else {
        console.error("Recibo.jsx - Unexpected dateInput type:", typeof dateInput, dateInput);
        return 'Data inválida';
    }

    let finalDateObject = baseDate;
    if (typeof dateInput === 'string') { 
        try {
            const validTimezone = typeof timezone === 'string' && timezone ? timezone : 'America/Sao_Paulo';
            finalDateObject = utcToZonedTime(baseDate, validTimezone);
        } catch (tzError) {
            console.error("Recibo.jsx - Error converting to zoned time:", tzError, baseDate, timezone);
            return 'Data inválida';
        }
    }

    if (!isValid(finalDateObject)) {
        console.error("Recibo.jsx - Final date object is Invalid Date:", finalDateObject);
        return 'Data inválida';
    }

    try {
        return format(finalDateObject, 'dd/MM/yyyy', { locale: ptBR });
    } catch (formatError) {
        console.error("Recibo.jsx - Error during final date formatting:", formatError, finalDateObject);
        return 'Data inválida';
    }
};

export const Recibo = React.forwardRef(({ data, signature, empresa, timezone, collectorName, coletaDateString, coletaTimeString }, ref) => {
    if (!data) return null;

    console.log('Recibo - coletaTimeString recebido:', coletaTimeString);
    console.log('🔍 Recibo - TODOS os campos disponíveis:', {
        cliente_nome: data.cliente_nome,
        nome_fantasia: data.nome_fantasia,
        razao_social: data.razao_social,
        cnpj_cpf: data.cnpj_cpf,
        cliente_cnpj_cpf: data.cliente_cnpj_cpf,
        endereco: data.endereco,
        cliente_endereco: data.cliente_endereco,
        TODOS_OS_CAMPOS: Object.keys(data)
    });

    const isCompra = data.tipo_coleta === 'Compra';
    const resultadoFinal = isCompra
        ? formatCurrency(parseCurrency(data.total_pago))
        : `${Math.floor(data.quantidade_entregue || 0)} unidades`;
    
    // 🔽 CORREÇÃO DEFINITIVA - USA TODOS OS CAMPOS POSSÍVEIS
    const clientName = data.nome_fantasia && data.razao_social 
      ? `${data.nome_fantasia} - ${data.razao_social}`
      : data.cliente_nome || data.nome_fantasia || data.razao_social || `Cliente ID: ${data.cliente_id}`;

    // USA TODOS OS CAMPOS POSSÍVEIS PARA CNPJ/CPF
    const clientCnpjCpf = data.cliente_cnpj_cpf || data.cnpj_cpf || 'Não informado';

    // FORMATAR ENDEREÇO COMPLETO - PRIMEIRA LINHA: ENDEREÇO, SEGUNDA LINHA: CIDADE E UF
    const formatCompleteAddress = () => {
        const endereco = data.cliente_endereco || data.endereco || '';
        const bairro = data.cliente_bairro || data.bairro || '';
        const municipio = data.cliente_municipio || data.municipio || '';
        const estado = data.cliente_estado || data.estado || '';
        
        // Primeira linha: endereço e bairro (se houver)
        const enderecoParts = [];
        if (endereco) enderecoParts.push(endereco);
        if (bairro) enderecoParts.push(bairro);
        const enderecoLinha = enderecoParts.length > 0 ? enderecoParts.join(', ') : 'Endereço não informado';
        
        // Segunda linha: separar títulos dos valores
        const cidade = municipio ? municipio.toUpperCase() : '';
        const uf = estado ? estado.toUpperCase() : '';
        
        return {
            endereco: enderecoLinha,
            cidade: cidade,
            uf: uf
        };
    };
    
    const clientAddress = formatCompleteAddress();

    console.log('✅ DEBUG Recibo - Dados FINAIS CORRETOS:', {
        nomeFinal: clientName,
        cnpj_cpf: clientCnpjCpf,
        endereco: clientAddress.endereco,
        cidade: clientAddress.cidade,
        uf: clientAddress.uf,
        cliente_nome: data.cliente_nome,
        nome_fantasia: data.nome_fantasia,
        razao_social: data.razao_social,
        cliente_cnpj_cpf: data.cliente_cnpj_cpf,
        cnpj_cpf_field: data.cnpj_cpf,
        cliente_endereco: data.cliente_endereco,
        endereco_field: data.endereco
    });

    // Dados fallback robustos para a empresa
    const empresaData = empresa || {
        nome_fantasia: 'Nome da Empresa',
        razao_social: 'Razão Social da Empresa',
        cnpj: 'N/A',
        telefone: 'N/A',
        email: 'N/A',
        endereco: 'Endereço não informado',
        municipio: '',
        estado: '',
        logo_documento_url: null,
        timezone: 'America/Sao_Paulo'
    };

    console.log('🏢 Recibo - Dados da empresa COMPLETOS:', empresaData);
    console.log('🏢 Recibo - Todos os campos:', Object.keys(empresaData));
    console.log('🏢 Recibo - empresa prop recebida (OBJETO COMPLETO):', JSON.stringify(empresa, null, 2));
    console.log('🏢 Recibo - empresaData.municipio direto:', empresaData.municipio);
    console.log('🏢 Recibo - empresaData.estado direto:', empresaData.estado);
    console.log('🏢 Recibo - empresa?.municipio:', empresa?.municipio);
    console.log('🏢 Recibo - empresa?.estado:', empresa?.estado);

    // Estado para controlar erros de carregamento da logo
    const [logoError, setLogoError] = useState(false);
    const [logoLoaded, setLogoLoaded] = useState(false);

    // Função para lidar com erro no carregamento da logo
    const handleLogoError = () => {
        console.warn('Erro ao carregar logo da empresa. Usando fallback.');
        setLogoError(true);
    };

    // Função para lidar com sucesso no carregamento da logo
    const handleLogoLoad = () => {
        setLogoLoaded(true);
    };

    return (
        <div ref={ref} className="bg-white text-gray-800 p-8 rounded-lg shadow-lg font-sans text-sm max-w-md mx-auto border border-gray-200" style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            lineHeight: '1.15',
            letterSpacing: 'normal'
        }}>
            <header className="text-center mb-6 pb-4 border-b border-gray-300">
                <div className="flex justify-center items-center mb-4 h-20">
                    {empresaData.logo_documento_url && !logoError ? (
                        <>
                            <img 
                                src={empresaData.logo_documento_url} 
                                alt="Logo da Empresa" 
                                className="max-h-full max-w-full object-contain" 
                                crossOrigin="anonymous"
                                onError={handleLogoError}
                                onLoad={handleLogoLoad}
                                style={{ 
                                    display: logoLoaded ? 'block' : 'none',
                                    opacity: logoLoaded ? 1 : 0 
                                }}
                            />
                            {!logoLoaded && !logoError && (
                                <div className="text-gray-400 text-sm">Carregando logo...</div>
                            )}
                        </>
                    ) : (
                        <h1 className="text-xl font-bold" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            {empresaData.nome_fantasia}
                        </h1>
                    )}
                </div>
                <div className="text-xs space-y-1">
                    <p className="font-bold" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        {empresaData.razao_social}
                    </p>
                    <p style={{ wordWrap: 'break-word', maxWidth: '100%' }}>
                        {empresaData.endereco}
                    </p>
                    {(() => {
                        const municipio = empresaData.municipio?.trim() || '';
                        const estado = empresaData.estado?.trim() || '';
                        if (municipio || estado) {
                            return (
                                <p style={{ wordWrap: 'break-word', maxWidth: '100%' }}>
                                    {municipio}{municipio && estado ? ' - ' : ''}{estado}
                                </p>
                            );
                        }
                        return null;
                    })()}
                    <p>CNPJ: {empresaData.cnpj ? formatCnpjCpf(empresaData.cnpj) : 'N/A'}</p>
                    <p>Telefone: {empresaData.telefone} | Email: {empresaData.email}</p>
                </div>
                <div className="mt-4 text-left">
                    <p className="text-gray-700 font-semibold" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                        RECIBO DE COLETA <span className="text-red-600 font-bold">Nº {data.numero_coleta?.toString().padStart(6, '0')}</span>
                    </p>
                </div>
            </header>

            <main className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wide">CLIENTE</p>
                        <p className="font-semibold mt-1" style={{ 
                            wordWrap: 'break-word',
                            maxWidth: '100%',
                            fontFamily: 'Arial, Helvetica, sans-serif'
                        }}>
                            {clientName}
                        </p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wide">ENDEREÇO</p>
                        <p className="font-semibold mt-1" style={{ 
                            wordWrap: 'break-word',
                            maxWidth: '100%',
                            fontFamily: 'Arial, Helvetica, sans-serif'
                        }}>
                            {clientAddress.endereco}
                        </p>
                    </div>
                    {(clientAddress.cidade || clientAddress.uf) && (
                        <div className="col-span-2">
                            <p className="font-semibold" style={{ 
                                wordWrap: 'break-word',
                                maxWidth: '100%',
                                fontFamily: 'Arial, Helvetica, sans-serif'
                            }}>
                                {clientAddress.cidade}{clientAddress.cidade && clientAddress.uf ? ' - ' : ''}{clientAddress.uf}
                            </p>
                        </div>
                    )}
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide">CNPJ/CPF</p>
                        <p className="font-semibold mt-1" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            {clientCnpjCpf ? formatCnpjCpf(clientCnpjCpf) : 'Não informado'}
                        </p>
                    </div>
                    <div className="col-span-2 flex flex-wrap justify-between gap-x-4 gap-y-3">
                        <div className="min-w-[100px]">
                            <p className="text-gray-500 text-xs uppercase tracking-wide">DATA DA COLETA</p>
                            <p className="font-semibold mt-1" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                {formatDisplayDate(coletaDateString, timezone)}
                            </p>
                        </div>
                        <div className="min-w-[80px]">
                            <p className="text-gray-500 text-xs uppercase tracking-wide">HORA DA COLETA</p>
                            <p className="font-semibold mt-1" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                {coletaTimeString || 'N/A'}
                            </p>
                        </div>
                        <div className="min-w-[100px]">
                            <p className="text-gray-500 text-xs uppercase tracking-wide">COLETADO POR</p>
                            <p className="font-semibold mt-1" style={{ 
                                wordWrap: 'break-word',
                                maxWidth: '100%',
                                fontFamily: 'Arial, Helvetica, sans-serif'
                            }}>
                                {collectorName || 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-4"></div>

                <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                    <thead>
                        <tr className="border-b border-gray-300">
                            <th className="text-left py-2 text-gray-500 font-normal text-xs uppercase tracking-wide">DESCRIÇÃO</th>
                            <th className="text-right py-2 text-gray-500 font-normal text-xs uppercase tracking-wide">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="py-2 align-top">Tipo de Coleta</td>
                            <td className="text-right py-2 font-semibold align-top">{data.tipo_coleta}</td>
                        </tr>
                        <tr>
                            <td className="py-2 align-top">Qtd. Coletada</td>
                            <td className="text-right py-2 font-semibold align-top">
                                {Number(data.quantidade_coletada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
                            </td>
                        </tr>
                        {isCompra ? (
                            <>
                                <tr>
                                    <td className="py-2 align-top">Valor por Kg</td>
                                    <td className="text-right py-2 font-semibold align-top">{formatCurrency(data.valor_compra)}</td>
                                </tr>
                                <tr className="border-t border-gray-300 font-bold text-base">
                                    <td className="py-3 align-top">Total Pago</td>
                                    <td className="text-right py-3 align-top">{resultadoFinal}</td>
                                </tr>
                            </>
                        ) : (
                            <>
                                <tr>
                                    <td className="py-2 align-top">Fator de Troca</td>
                                    <td className="text-right py-2 font-semibold align-top">{data.fator}</td>
                                </tr>
                                <tr className="border-t border-gray-300 font-bold text-base">
                                    <td className="py-3 align-top">
                                      Qtd. Entregue
                                      <p className="text-xs font-normal text-gray-500 mt-1">* Valor Arredondado.</p>
                                    </td>
                                    <td className="text-right py-3 align-top">{resultadoFinal}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </main>

            <footer className="mt-8 text-center">
                <p className="text-gray-500 mb-2 text-xs uppercase tracking-wide">Assinatura do Cliente</p>
                <div className="w-full h-48 border border-gray-300 rounded-md flex items-center justify-center bg-gray-50">
                    {signature ? (
                        <img 
                            src={signature} 
                            alt="Assinatura do cliente" 
                            className="max-h-[54%] max-w-[54%] object-contain"
                            crossOrigin="anonymous"
                            onError={(e) => {
                                console.warn('Erro ao carregar assinatura');
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div className="border-b-2 border-gray-400 w-4/5"></div>
                    )}
                </div>
            </footer>
        </div>
    );
});

Recibo.displayName = 'Recibo';

export default Recibo;