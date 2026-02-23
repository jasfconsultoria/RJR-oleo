import React, { useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatCnpjCpf, valorPorExtenso } from '@/lib/utils';

const formatDisplayDate = (dateInput) => {
    if (!dateInput) {
        return 'N/A';
    }

    let baseDate;
    if (dateInput instanceof Date) {
        baseDate = dateInput;
    } else if (typeof dateInput === 'string') {
        const parsedDate = parseISO(dateInput);
        if (!isValid(parsedDate)) {
            console.error("ReciboAvulso.jsx - Invalid date string provided:", dateInput);
            return 'Data inválida';
        }
        baseDate = parsedDate;
    } else {
        console.error("ReciboAvulso.jsx - Unexpected dateInput type:", typeof dateInput, dateInput);
        return 'Data inválida';
    }

    if (!isValid(baseDate)) {
        console.error("ReciboAvulso.jsx - Final date object is Invalid Date:", baseDate);
        return 'Data inválida';
    }

    try {
        return format(baseDate, 'dd/MM/yyyy', { locale: ptBR });
    } catch (formatError) {
        console.error("ReciboAvulso.jsx - Error during final date formatting:", formatError, baseDate);
        return 'Data inválida';
    }
};

export const ReciboAvulso = React.forwardRef(({ data, signature, empresa, timezone, hideHeader = false }, ref) => {
    if (!data) return null;

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

    const valorExtenso = valorPorExtenso(data.valor || 0);
    const dataFormatada = formatDisplayDate(data.data_recibo);

    return (
        <div ref={ref} className="bg-white text-gray-800 pt-16 pb-12 px-6 rounded-lg shadow-lg font-sans text-base max-w-2xl mx-auto border border-gray-100 receipt-container" style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            lineHeight: '1.8',
            letterSpacing: 'normal'
        }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        size: A4;
                        margin: 2cm;
                    }
                    body {
                        background: white !important;
                    }
                    .receipt-container {
                        box-shadow: none !important;
                        border: 1px solid #eee !important;
                        max-width: 10cm !important;
                        margin: 0 auto !important;
                        padding-top: 1cm !important;
                        padding-bottom: 1cm !important;
                        transform: scale(0.5);
                        transform-origin: top center;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}} />
            {!hideHeader && (
                <header className="flex justify-between items-start mb-10 pb-6 border-b border-gray-300">
                    <div className="w-1/3 flex items-start h-24">
                        {empresaData.logo_documento_url && !logoError ? (
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
                        ) : (
                            <div className="font-bold text-xl">{empresaData.nome_fantasia}</div>
                        )}
                    </div>

                    <div className="w-2/3 text-right text-xs space-y-1">
                        <h1 className="text-base font-bold uppercase" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            {empresaData.nome_fantasia} - {empresaData.razao_social}
                        </h1>
                        <p>CNPJ: {empresaData.cnpj ? formatCnpjCpf(empresaData.cnpj) : 'N/A'}</p>
                        <p>{empresaData.endereco}</p>
                        <p>{empresaData.municipio}{empresaData.municipio && empresaData.estado ? ' - ' : ''}{empresaData.estado}</p>
                        <p>Telefone: {empresaData.telefone} | Email: {empresaData.email}</p>
                    </div>
                </header>
            )}

            {/* Cabeçalho do Recibo: Título, Número e Valor */}
            <div className="mb-10 space-y-6">
                <div className="text-center border-b-2 border-gray-100 pb-4">
                    <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-gray-800">
                        RECIBO DE PRESTAÇÃO DE SERVIÇOS
                    </h2>
                </div>

                <div className="flex justify-between items-end px-2">
                    <div className="text-left">
                        <p className="text-red-600 font-bold text-xl">
                            RECIBO Nº {data.numero_recibo?.toString().padStart(6, '0')}
                        </p>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-gray-400 font-mono uppercase leading-none mb-1">VALOR:</span>
                        <span className="text-4xl font-black text-gray-900 leading-none">
                            {formatCurrency(data.valor || 0)}
                        </span>
                    </div>
                </div>
            </div>

            <main className="space-y-6 text-justify">
                <p>
                    Eu, <strong className="uppercase">{data.pessoa_nome || '________________________________________'}</strong>,
                    CPF/CNPJ nº <strong>{data.pessoa_cnpj_cpf ? formatCnpjCpf(data.pessoa_cnpj_cpf) : '_________________________________'}</strong>,
                    residente/sediado à <strong>{(() => {
                        const parts = [];
                        if (data.pessoa_endereco) parts.push(data.pessoa_endereco);
                        if (data.pessoa_municipio) parts.push(data.pessoa_municipio);
                        if (data.pessoa_estado) parts.push(data.pessoa_estado);

                        // Se tiver endereço de rua, coloca vírgula antes da cidade
                        // Se não tiver rua mas tiver cidade, separa cidade-estado
                        const enderecoCompleto = parts.length > 0 ? parts.join(', ') : '';

                        // Ajuste visual para separar cidade e estado por hífen em vez de vírgula se desejar seguir o padrão brasileiro,
                        // mas manter partes.join(', ') é mais seguro para endereços genéricos.
                        // Vamos usar uma lógica mais refinada:
                        let displayEndereco = '';
                        if (data.pessoa_endereco) {
                            displayEndereco += data.pessoa_endereco;
                            if (data.pessoa_municipio || data.pessoa_estado) displayEndereco += ', ';
                        }
                        if (data.pessoa_municipio) {
                            displayEndereco += data.pessoa_municipio;
                            if (data.pessoa_estado) displayEndereco += ' - ';
                        }
                        if (data.pessoa_estado) {
                            displayEndereco += data.pessoa_estado;
                        }

                        return displayEndereco || '____________________________________________________________';
                    })()}</strong>,
                </p>

                <p>
                    declaro que recebi da empresa <strong>{empresaData.nome_fantasia} - {empresaData.razao_social}</strong>,
                    CNPJ nº <strong>{formatCnpjCpf(empresaData.cnpj)}</strong>,
                    a quantia de <strong>{formatCurrency(data.valor || 0)} ({valorExtenso})</strong>,
                    referente à prestação dos seguintes serviços:
                    <strong> {data.descricao || '__________________________________________________________________________'}</strong>
                </p>

                <p>
                    Declaro que o valor acima mencionado foi recebido nesta data, dando plena, geral e irrevogável quitação dos serviços prestados.
                </p>

                <div className="mt-12 text-right">
                    <p>
                        <strong>{empresaData.municipio || '____________'} - {empresaData.estado || '____'}, {data.data_recibo ? format(data.data_recibo instanceof Date ? data.data_recibo : parseISO(data.data_recibo), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '____ de ________ de _______'}.</strong>
                    </p>
                </div>
            </main>

            <footer className="mt-16 flex flex-col items-center">
                <div className="w-2/3 pt-4 flex flex-col items-center">
                    {signature ? (
                        <div className="relative z-10 w-full flex justify-center h-24 mb-2">
                            <img
                                src={signature}
                                alt="Assinatura"
                                className="max-h-full max-w-full object-contain"
                                crossOrigin="anonymous"
                            />
                        </div>
                    ) : (
                        <p className="text-sm font-semibold mt-2 mb-2">Assinatura do Prestador de Serviço</p>
                    )}

                    <div className="text-center mt-2 pt-2 border-t-2 border-gray-400 w-full">
                        <p className="text-sm">Nome: <strong>{data.pessoa_nome || '__________________________________'}</strong></p>
                        <p className="text-sm">CPF/CNPJ: <strong>{data.pessoa_cnpj_cpf ? formatCnpjCpf(data.pessoa_cnpj_cpf) : '_______________________________'}</strong></p>
                    </div>
                </div>
            </footer>
        </div>
    );
});

ReciboAvulso.displayName = 'ReciboAvulso';

export default ReciboAvulso;
