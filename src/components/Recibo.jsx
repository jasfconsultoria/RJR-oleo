import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, parseCurrency, formatCnpjCpf } from '@/lib/utils';
import { formatInTimeZone, utcToZonedTime } from 'date-fns-tz'; // Importar formatInTimeZone e utcToZonedTime

const formatDateTime = (dateString, timezone) => {
    if (!dateString) return 'N/A';
    try {
        // Converte a string ISO (que é UTC) para a data no fuso horário da empresa
        const zonedDate = utcToZonedTime(dateString, timezone);
        return formatInTimeZone(zonedDate, timezone, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
        console.error("Erro ao formatar data/hora no recibo:", error);
        return 'Data inválida';
    }
};

export const Recibo = React.forwardRef(({ data, signature, empresa, timezone }, ref) => { // Adicionar timezone como prop
    if (!data) return null; // Mantém esta verificação para o objeto de dados principal

    const isCompra = data.tipo_coleta === 'Compra';
    const resultadoFinal = isCompra
        ? formatCurrency(parseCurrency(data.total_pago))
        : `${Math.floor(data.quantidade_entregue || 0)} litros`;
    
    // Usa encadeamento opcional e fornece valores de fallback para os dados do cliente
    const clientName = data.pessoa?.nome || data.cliente_nome || 'Cliente não informado';
    // Prioriza data.cnpj_cpf e data.endereco que são adicionados no objeto de coleta no ColetaForm
    const clientCnpjCpf = data.pessoa?.cnpj_cpf || data.cnpj_cpf || data.cliente_cnpj_cpf;
    const clientAddress = data.pessoa?.endereco || data.endereco || data.cliente_endereco || 'Endereço não informado';

    return (
        <div ref={ref} className="bg-white text-gray-800 p-6 rounded-lg shadow-lg font-sans text-sm max-w-md mx-auto border border-gray-200">
            <header className="text-center mb-4 pb-4 border-b border-gray-300">
                <div className="flex justify-center items-center mb-4 h-20">
                    {empresa?.logo_documento_url ? (
                        <img src={empresa.logo_documento_url} alt="Logo da Empresa" className="max-h-full max-w-full object-contain" crossOrigin="anonymous" />
                    ) : (
                        <h1 className="text-xl font-bold">{empresa?.nome_fantasia || 'Nome da Empresa'}</h1>
                    )}
                </div>
                <div className="text-xs">
                    <p className="font-bold">{empresa?.razao_social}</p>
                    <p>{empresa?.endereco}</p>
                    <p>CNPJ: {empresa?.cnpj ? formatCnpjCpf(empresa.cnpj) : 'N/A'}</p>
                    <p>Telefone: {empresa?.telefone} | Email: {empresa?.email}</p>
                </div>
                <div className="mt-4 text-left">
                    <p className="text-gray-700 font-semibold">
                        RECIBO <span className="text-red-600 font-bold">Nº {data.numero_coleta?.toString().padStart(6, '0')}</span>
                    </p>
                </div>
            </header>

            <main className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div className="col-span-2">
                        <p className="text-gray-500">CLIENTE</p>
                        <p className="font-semibold">{clientName}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">CNPJ/CPF</p>
                        <p className="font-semibold">{clientCnpjCpf ? formatCnpjCpf(clientCnpjCpf) : 'Não informado'}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">DATA/HORA DA COLETA</p>
                        <p className="font-semibold">{formatDateTime(data.data_coleta, timezone)}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-gray-500">ENDEREÇO</p>
                        <p className="font-semibold">{clientAddress}</p>
                    </div>
                </div>

                <div className="border-t border-dashed my-4"></div>

                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left py-2 text-gray-500 font-normal">DESCRIÇÃO</th>
                            <th className="text-right py-2 text-gray-500 font-normal">VALOR</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="py-2">Tipo de Coleta</td>
                            <td className="text-right py-2 font-semibold">{data.tipo_coleta}</td>
                        </tr>
                        <tr>
                            <td className="py-2">Qtd. Coletada</td>
                            <td className="text-right py-2 font-semibold">{Number(data.quantidade_coletada).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg</td>
                        </tr>
                        {isCompra ? (
                            <>
                                <tr>
                                    <td className="py-2">Valor por Kg</td>
                                    <td className="text-right py-2 font-semibold">{formatCurrency(data.valor_compra)}</td>
                                </tr>
                                <tr className="border-t font-bold text-base">
                                    <td className="py-3">Total Pago</td>
                                    <td className="text-right py-3">{resultadoFinal}</td>
                                </tr>
                            </>
                        ) : (
                            <>
                                <tr>
                                    <td className="py-2">Fator de Troca</td>
                                    <td className="text-right py-2 font-semibold">{data.fator}</td>
                                </tr>
                                <tr className="border-t font-bold text-base">
                                    <td className="py-3">
                                      Qtd. a Entregar
                                      <p className="text-xs font-normal text-gray-500">* Valor Arredondado.</p>
                                    </td>
                                    <td className="text-right py-3 align-bottom">{resultadoFinal}</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </main>

            <footer className="mt-8 text-center">
                <p className="text-gray-500 mb-2">Assinatura do Cliente</p>
                <div className="w-full h-24 border rounded-md flex items-center justify-center bg-gray-50">
                    {signature ? (
                        <img src={signature} alt="Assinatura do cliente" className="max-h-full max-w-full" crossOrigin="anonymous" />
                    ) : (
                        <div className="border-b-2 border-gray-400 w-4/5"></div>
                    )}
                </div>
            </footer>
        </div>
    );
});