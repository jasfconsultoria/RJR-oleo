# Edge Function: change-password

Esta Edge Function permite que administradores alterem a senha de outros usuários usando a API de administração do Supabase.

## Configuração

### Variáveis de Ambiente

Certifique-se de que as seguintes variáveis de ambiente estão configuradas no Supabase Dashboard:

- `SUPABASE_URL`: A URL do seu projeto Supabase
- `SUPABASE_ANON_KEY`: A chave anônima do Supabase (para verificar autenticação)
- `SUPABASE_SERVICE_ROLE_KEY`: A chave de service role do Supabase (NUNCA exponha isso no frontend!)

**Nota:** As variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` geralmente já estão configuradas automaticamente pelo Supabase. Você só precisa garantir que `SUPABASE_SERVICE_ROLE_KEY` esteja configurada.

### Deploy

Para fazer o deploy desta função, use o Supabase CLI:

```bash
supabase functions deploy change-password
```

Ou através do Supabase Dashboard:
1. Vá para "Edge Functions" no menu lateral
2. Clique em "Create a new function"
3. Nomeie como "change-password"
4. Cole o conteúdo do arquivo `index.ts`
5. Configure as variáveis de ambiente necessárias
6. Faça o deploy

## Segurança

Esta função:
- Verifica se o usuário está autenticado
- Verifica se o usuário tem o papel de "administrador" na tabela `profiles`
- Usa a service role key apenas no backend (nunca exposta ao frontend)
- Valida que a senha tem pelo menos 6 caracteres

## Uso

A função é chamada automaticamente pelo componente `ChangePasswordDialog.jsx` quando um administrador tenta alterar a senha de um usuário.

