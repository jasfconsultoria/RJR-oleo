# Documentação Completa do Sistema RJR Coletas (SGMO)

Este documento fornece uma descrição detalhada, funcional e técnica do sistema **SGMO - Sistema de Coletas**, desenvolvido para a empresa **RJR Coletas**. O sistema é uma plataforma ERP (Enterprise Resource Planning) completa para a gestão de coleta, processamento e logística de óleo de fritura usado (animal e vegetal). A **RJR Coletas** é uma empresa especializada em coleta de óleo de fritura de origem animal e vegetal com operacaçoes nos estados do Pará, Tocantins e Maranhão.

---

## 1. Visão Geral e Objetivo
O SGMO - Sistema de Coletas foi concebido para digitalizar e otimizar toda a cadeia de suprimentos da RJR Coletas. Ele substitui processos manuais por um fluxo de trabalho automatizado que abrange desde a prospecção de clientes até a emissão de certificados ambientais e controle financeiro rigoroso.

**Público-alvo:** Administradores, Gerentes de Logística, Operadores de Estoque e Coletores de Campo.

---

## 2. Tecnologias e Arquitetura
*   **Frontend:** React com Vite (SPA - Single Page Application).
*   **Estilização:** Tailwind CSS com componentes UI premium (Shadcn/UI).
*   **Animações:** Framer Motion para transições suaves e interatividade.
*   **Backend & DB:** Supabase (PostgreSQL) com uso intensivo de **RLS (Row Level Security)** para segurança de dados.
*   **Linguagem:** JavaScript (JSX/TSX).
*   **Gestão de Datas:** `date-fns` e `date-fns-tz` para tratamento rigoroso de fusos horários.
*   **Máscaras e Formatação:** `react-imask` para documentos e telefones.
*   **Documentos Dinâmicos:** `html2canvas` e `jspdf` para geração de PDFs no cliente.
*   **BI e Exportação:** `recharts` para gráficos e `xlsx` para exportação de planilhas.
*   **Segurança:** Supabase RLS (Row Level Security) e Logs de Auditoria (`logAction`).

---

## 3. Fluxo de Experiência do Usuário (Passo a Passo)

### 3.1. Landing Page e Acesso Público
A porta de entrada do sistema é uma página institucional moderna que apresenta a marca RJR Óleo.
*   **Conteúdo:** Missão da empresa, áreas de atuação (PA, TO, MA) e rodapé com links úteis.
*   **Páginas de Informação:** Ajuda, FAQ e Histórico de Versões.
*   **Visualizador de Documentos:** Rotas públicas para visualização de certificados e recibos via QR Code ou links compartilhados.

### 3.2. Tela de Login (Autenticação)
Ambiente seguro para acesso dos colaboradores.
*   **Funcionalidades:** Login por E-mail/Senha, "Esqueci minha senha" com envio de link de recuperação automático via Supabase Auth.
*   **Design:** Backdrop blur com gradiente em tons de esmeralda e teal, seguindo a identidade visual "Premium" do projeto.

---

## 4. Mapeamento do Menu e Funcionalidades

### 4.1. Dashboard (Painel de Controle)
Visão consolidada do negócio em tempo real.
*   **Indicadores (Cards):** Total de coletas (volume em litros), saldo financeiro, volume em estoque e novas adesões de clientes.
*   **Gráficos:** Desempenho mensal de coletas e lucratividade.

### 4.2. Cadastro (Base do Sistema)
*   **Clientes:** Cadastro completo de estabelecimentos (restaurantes, hotéis, residências). Inclui geolocalização para visualização em mapa e vínculo de contratos.
*   **Fornecedores:** Gestão de parceiros que fornecem insumos ou serviços.
*   **Contratos:** Gestão de acordos comerciais com prazos, preços e condições de coleta. Geração automática de documentos PDF e suporte a assinaturas digitais.

### 4.3. Coletas (Coração da Operação)
*   **Lista de Coletas:** Acompanhamento de todas as ordens de coleta.
*   **Nova Coleta (Formulário Inteligente):**
    *   Seleção de cliente com preenchimento automático de dados.
    *   Registro de volume coletado (Óleo Bruto/Filtrado).
    *   Cálculo automático de pagamento (baseado no contrato do cliente).
    *   **Automação:** Ao salvar uma coleta, o sistema gera automaticamente um lançamento financeiro, uma movimentação de estoque e um recibo digital.
*   **Rotas e Mapa:** Otimização logística exibindo clientes em um mapa interativo para planejar as visitas dos coletores.
*   **Agenda:** Calendário com coletas previstas e recorrentes.
*   **Roteiro:** Guia sequencial para o motorista no dia de operação.

### 4.4. Recipientes (Comodato):
*   Controle de saldo de bombonas e tambores por cliente.
*   **Extrato Detalhado:** Modal que exibe o histórico de entregas e coletas de recipientes.
*   **Ajuste de Saldo Legado:** Tratamento especial para saldos anteriores ao início do rastreio digital.
*   Rastreabilidade total: saída do depósito -> cliente -> retorno (cheio/vazio).

### 4.5. Certificados (MTR / Meio Ambiente)
*   Geração imediata de certificados de destinação final.
*   Conformidade com normas ambientais, permitindo que o cliente apresente o documento à fiscalização sanitária.

### 4.6. Financeiro
*   **Crédito:** Lançamentos de entradas e receitas.
*   **Débito:** Pagamentos a clientes (pela compra do óleo) e despesas fixas.
*   **Recibos Avulsos:** Geração de comprovantes de pagamento para fins diversos.
*   **Centro de Custos:** Classificação financeira por unidade ou categoria.

### 4.7. Estoque
*   **Produtos:** Cadastro de itens (Óleo, Filtros, EPIs).
*   **Entradas/Saídas:** Registro manual ou automático de movimentações.
*   **Saldo:** Visualização do inventário atualizado por depósito.

### 4.8. Relatórios (BI)
*   Módulo de extração de dados com filtros avançados:
    *   Relatórios de volumes coletados por região/período.
    *   Relatórios financeiros detalhados (DRE).
    *   Relatório de estoque e recipientes.

---

## 5. Regras de Negócio e Documentação Técnica

### 5.1. Níveis de Permissão (Roles)
1.  **Super Admin:** Acesso total, incluindo gestão de múltiplos bancos de dados e logs globais.
2.  **Administrador:** Gestão financeira, configurações da empresa e RH (usuários).
3.  **Gerente:** Supervisão de estoque, coletas e geração de certificados.
4.  **Coletor:** Acesso limitado à execução das rotas e registro de novas coletas.

### 5.2. Segurança e Integridade (RLS)
O banco de dados utiliza **Políticas de RLS** para garantir que uma unidade/empresa não veja os dados da outra. Todo acesso é filtrado pelo `user_id` e `role` do perfil logado.

### 5.3. Sistema de Logs e Auditoria
Cada alteração em campos sensíveis (como preço do óleo em contratos ou exclusão de financeiro) é registrada em uma tabela de logs, contendo o autor, data, ambiente e a query executada.

### 5.4. Automações de Banco de Dados (Triggers/RPCs)
*   **Trigger de Perfil:** Ao criar um usuário no Auth do Supabase, um perfil correspondente é criado automaticamente na tabela `profiles`.
*   **RPC de Fechamento:** Funções PL/pgSQL complexas que processam a assinatura de recibos e atualizam simultaneamente o financeiro e estoque, garantindo atomicidade (tudo ou nada).

---

## 6. Diferenciais do SGMO
*   **Efeito Premium:** Interface escura (dark mode) por padrão com tons de verde "Emerald", transmitindo sustentabilidade e tecnologia.
*   **Assinatura Digital Integrada:** Elimina a necessidade de papel no campo; o cliente assina diretamente no tablet/celular do coletor.
*   **Offline First Ready:** Estrutura preparada para lidar com áreas de baixa conectividade durante as coletas.

---
**Documento gerado para processamento no NotebookLM.**
*Data: 19 de Março de 2026*
*Versão do Sistema: 4.8.1*
