-- Migração Simplificada para Versões
CREATE TABLE IF NOT EXISTS public.versoes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    versao text NOT NULL,
    data_implantacao timestamp with time zone DEFAULT now(),
    descricao text,
    hash text,
    created_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS básico
ALTER TABLE public.versoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos podem ver as versões" ON public.versoes;
CREATE POLICY "Todos podem ver as versões" ON public.versoes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Apenas Super Admin pode gerenciar versões" ON public.versoes;
CREATE POLICY "Apenas Super Admin pode gerenciar versões" ON public.versoes FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

-- INSERT DIRETO (Removido o ON CONFLICT para evitar erros de constraint)
INSERT INTO public.versoes (versao, descricao, hash)
VALUES (
    '5.0.0',
    '### Módulo de Notificações Inteligentes & Refinamentos Operacionais 🚀

**Principais Novidades:**
- **Sistema de Notificações:** Lançamento do motor de alertas automáticos para coletas, contratos e financeiro.
- **Sino de Avisos:** Interface reativa no header com contagem em tempo real.
- **Painel de Auditoria:** Nova tela de configuração para gestão de alertas (Super Admin).

**Melhorias Técnicas:**
- **Sincronização de Timezone:** Correção global para o fuso horário de Brasília (UTC-3), garantindo precisão milimétrica na Agenda Operacional.
- **Automação de Cadastro:** Busca automática de dados de clientes via CNPJ no formulário de coleta.
- **Segurança de Contratos:** Restrição de edição para o perfil de Coletor e ajustes de acesso em arquivos PDF.

**Correções:**
- Resolvido erro 400 no relatório de estoque e padronização de filtros na lista de contratos.',
    '8f7c2a1'
);
