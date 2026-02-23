import { supabase } from './customSupabaseClient';

/**
 * Verifica se um lançamento financeiro pode ser excluído com base em sua origem e pagamentos.
 * @param {string} id - ID do lançamento (UUID).
 * @param {string} documento - Número do documento.
 * @param {string} observacao - Descrição/Observação.
 * @returns {Promise<{canDelete: boolean, reason?: string}>}
 */
/**
 * Verifica se um lançamento financeiro pode ser excluído com base em sua origem e pagamentos.
 * @param {Object} entry - Objeto do lançamento.
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const checkFinanceiroIntegrity = async (entry) => {
    try {
        const { id, installment_number, total_installments } = entry;

        // 1. Verificar regra de parcelas (Entrada 0 ou 1/1)
        const isEntrance = installment_number === 0;
        const isSingleInstallment = installment_number === 1 && total_installments === 1;

        if (!isEntrance && !isSingleInstallment) {
            return {
                success: false,
                message: 'Não é possível excluir parcelas individuais. Para excluir o documento completo, exclua a "Entrada" ou a parcela "1/1".'
            };
        }

        // 2. Verificar se há pagamentos vinculados em QUALQUER parcela do documento
        const { data: allInstallments, error: installmentsError } = await supabase
            .from('credito_debito')
            .select('id')
            .eq('lancamento_id', entry.lancamento_id);

        if (installmentsError) {
            console.error('Erro ao buscar parcelas:', installmentsError);
            return { success: false, message: 'Erro ao validar parcelas do documento.' };
        }

        const installmentIds = allInstallments.map(i => i.id);

        const { data: payments, error: paymentsError } = await supabase
            .from('pagamentos')
            .select('id, credito_debito_id')
            .in('credito_debito_id', installmentIds);

        if (paymentsError) {
            console.error('Erro ao verificar pagamentos:', paymentsError);
            return { success: false, message: 'Erro ao verificar dependências de pagamentos.' };
        }

        if (payments && payments.length > 0) {
            return {
                success: false,
                message: 'Não é possível excluir o documento pois existem pagamentos registrados em uma ou mais parcelas. Remova os pagamentos primeiro.'
            };
        }

        return { success: true };
    } catch (error) {
        console.error('Erro inesperado na verificação de integridade:', error);
        return { success: false, message: 'Erro inesperado ao validar a exclusão.' };
    }
};
