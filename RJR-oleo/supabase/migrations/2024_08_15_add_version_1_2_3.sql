INSERT INTO public.versoes (versao, data_implantacao, descricao, hash)
VALUES (
    '1.2.3',
    now(),
    '### Módulo Financeiro & Correções 🚀

**Novidades:**
- **Criação do Módulo Financeiro:** Lançamento completo das seções de Contas a Pagar (Débito) e Contas a Receber (Crédito).
- **Lançamentos Parcelados:** Agora é possível criar lançamentos financeiros com múltiplas parcelas, incluindo valor de entrada. O sistema calcula e gera as parcelas automaticamente.
- **Gestão de Pagamentos:** Implementada a funcionalidade para registrar pagamentos parciais ou totais para cada parcela.
- **Histórico de Pagamentos:** Adicionada uma tela para visualizar, editar e excluir pagamentos individuais de uma parcela.

**Melhorias e Correções:**
- Corrigido um bug crítico que impedia a edição de pagamentos devido a um problema de cache e nome de parâmetros na função do banco de dados (RPC).
- Aprimorada a validação e a lógica de cálculo de saldos no módulo financeiro.
- Otimizada a interface para uma gestão financeira mais clara e intuitiva.',
    NULL
);