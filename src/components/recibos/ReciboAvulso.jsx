import React, { useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatCnpjCpf } from '@/lib/utils';

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

export const ReciboAvulso = React.forwardRef(({ data, signature, empresa, timezone }, ref) => {
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

    // Tipo de recibo em português
    const tipoRecibo = {
        'cliente': 'RECIBO DE PRESTAÇÃO DE SERVIÇO',
        'fornecedor': 'RECIBO DE PRESTAÇÃO DE SERVIÇO',
        'coletor': 'RECIBO DE PRESTAÇÃO DE SERVIÇO'
    }[data.tipo] || 'RECIBO AVULSO';

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
                        {tipoRecibo} <span className="text-red-600 font-bold">Nº {data.numero_recibo?.toString().padStart(6, '0')}</span>
                    </p>
                </div>
            </header>

            <main className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="col-span-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wide">
                            {data.tipo === 'cliente' ? 'CLIENTE' : data.tipo === 'fornecedor' ? 'FORNECEDOR' : 'COLETOR'}
                        </p>
                        <p className="font-semibold mt-1" style={{ 
                            wordWrap: 'break-word',
                            maxWidth: '100%',
                            fontFamily: 'Arial, Helvetica, sans-serif'
                        }}>
                            {data.pessoa_nome || 'Não informado'}
                        </p>
                    </div>
                    {data.pessoa_endereco && (
                        <div className="col-span-2">
                            <p className="text-gray-500 text-xs uppercase tracking-wide">ENDEREÇO</p>
                            <p className="font-semibold mt-1" style={{ 
                                wordWrap: 'break-word',
                                maxWidth: '100%',
                                fontFamily: 'Arial, Helvetica, sans-serif'
                            }}>
                                {data.pessoa_endereco}
                            </p>
                        </div>
                    )}
                    {(data.pessoa_municipio || data.pessoa_estado) && (
                        <div className="col-span-2">
                            <p className="font-semibold" style={{ 
                                wordWrap: 'break-word',
                                maxWidth: '100%',
                                fontFamily: 'Arial, Helvetica, sans-serif'
                            }}>
                                {data.pessoa_municipio || ''}{data.pessoa_municipio && data.pessoa_estado ? ' - ' : ''}{data.pessoa_estado || ''}
                            </p>
                        </div>
                    )}
                    {data.pessoa_cnpj_cpf && (
                        <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wide">CNPJ/CPF</p>
                            <p className="font-semibold mt-1" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                {formatCnpjCpf(data.pessoa_cnpj_cpf)}
                            </p>
                        </div>
                    )}
                    <div className="min-w-[100px]">
                        <p className="text-gray-500 text-xs uppercase tracking-wide">DATA DO RECIBO</p>
                        <p className="font-semibold mt-1" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            {formatDisplayDate(data.data_recibo)}
                        </p>
                    </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-4"></div>

                <div className="space-y-3">
                    <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">DESCRIÇÃO</p>
                        <p className="font-semibold" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                            {data.descricao || 'Não informado'}
                        </p>
                    </div>
                    {data.observacoes && (
                        <div>
                            <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">OBSERVAÇÕES</p>
                            <p className="font-semibold" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                {data.observacoes}
                            </p>
                        </div>
                    )}
                    <div className="border-t border-gray-300 pt-3">
                        <div className="flex justify-between items-center">
                            <p className="text-gray-500 text-xs uppercase tracking-wide">VALOR</p>
                            <p className="font-bold text-lg" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                {formatCurrency(data.valor || 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="mt-8 text-center">
                <p className="text-gray-500 mb-2 text-xs uppercase tracking-wide">Assinatura</p>
                <div className="w-full h-48 border border-gray-300 rounded-md flex items-center justify-center bg-gray-50">
                    {signature ? (
                        <img 
                            src={signature} 
                            alt="Assinatura" 
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

ReciboAvulso.displayName = 'ReciboAvulso';

export default ReciboAvulso;
