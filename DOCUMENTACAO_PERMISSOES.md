# Módulo de Permissões Dinâmicas (RBAC) - RJR Óleo

Este módulo implementa um sistema de Controle de Acesso Baseado em Perfis (RBAC) granular e dinâmico, permitindo que administradores configurem o que cada tipo de usuário pode ver e fazer no sistema sem a necessidade de alterações no código fonte.

## 🚀 Arquitetura Técnica

O sistema foi construído sobre três pilares principais:

### 1. Camada de Dados (Supabase)
As permissões são armazenadas na tabela `public.role_menu_permissions`, que mapeia a relação entre Perfis (`user_role`) e Chaves de Menu (`menu_key`).
- **Campos**: `can_view`, `can_create`, `can_edit`, `can_delete`.
- **Segurança**: Políticas de RLS (Row Level Security) garantem que apenas administradores possam modificar essas configurações.

### 2. Contexto Global (`MenuPermissionsContext`)
Um provedor React que carrega as permissões do usuário logado durante a inicialização do app.
- Fornece a função `canView(permKey)` para toda a aplicação.
- Garante que a barra lateral (`AppLayout`) renderize apenas os menus autorizados.

### 3. Proteção de Rotas (`ProtectedRoute`)
Além de esconder itens visuais, o sistema bloqueia o acesso direto via URL. Se um usuário tentar acessar manualmente uma rota para a qual não tem a chave de permissão, ele é automaticamente redirecionado para o Dashboard.

## 🛠️ Funcionalidades Principais

- **Seletor de Perfil**: Interface focada no papel selecionado (Admin, Gerente, Coletor, etc.).
- **Controle Granular (CRUD)**:
  - **Acesso ao Menu**: Define se o menu aparece na barra lateral.
  - **Criar/Editar/Excluir**: Permissões específicas para operações em cada recurso.
- **Estrutura Hierárquica**: Suporte completo a submenus (ex: Configurações -> Usuários).
- **Proteção contra Auto-Bloqueio**: Menus vitais (como o próprio menu de Permissões para Super Admin) são protegidos contra desativação acidental.

## 📂 Arquivos do Módulo

| Arquivo | Descrição |
| :--- | :--- |
| `src/config/menuConfig.js` | Definição centralizada de toda a estrutura de menus e metadados de ações. |
| `src/contexts/MenuPermissionsContext.jsx` | Gerenciamento de estado e lógica de verificação global. |
| `src/pages/config/PermissionsPage.jsx` | Interface administrativa moderna baseada em cards. |
| `src/components/ui/switch.jsx` | Componente de interface customizado para os toggles. |
| `supabase/migrations/2149...` | Script original de criação da tabela de permissões. |
| `supabase/migrations/2150...` | Expansão para permissões granulares (CRUD). |

## 💡 Como Adicionar Novos Menus
Para registrar um novo menu no sistema de permissões:
1. Adicione o item no array `MENU_STRUCTURE` em `src/config/menuConfig.js`.
2. Defina uma `key` única.
3. Se o item tiver ações CRUD, defina `hasActions: true`.
4. O sistema irá gerar automaticamente o card de configuração na página de Permissões.
