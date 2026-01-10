# Update User Edge Function

Esta edge function permite atualizar informações de usuários em `auth.users` usando a Admin API do Supabase.

## Funcionalidades

- Atualiza `user_metadata.full_name` em `auth.users`
- Atualiza `app_metadata.role`, `app_metadata.estado` e `app_metadata.municipio` em `auth.users`
- Requer autenticação e permissão de administrador

## Uso

```typescript
const { data, error } = await supabase.functions.invoke('update-user', {
  body: {
    userId: 'uuid-do-usuario',
    userData: {
      full_name: 'Nome Completo',
      role: 'coletor',
      estado: 'SP',
      municipio: 'São Paulo'
    }
  }
});
```

## Segurança

- Requer token de autenticação válido
- Apenas administradores podem usar esta função
- Usa Admin API para atualizar `auth.users`

