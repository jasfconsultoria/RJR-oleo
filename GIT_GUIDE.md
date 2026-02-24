# Guia de Git e Implantação - RJR-oleo

Este guia centraliza as melhores práticas para o desenvolvimento, versionamento e deploy do projeto RJR-oleo.

## 1. Configuração de Identidade

Mantenha sua identidade configurada para que os commits fiquem registrados em seu nome:

```bash
git config --global user.email "jasfconsultoria@gmail.com"
git config --global user.name "Seu Nome"
```

---

## 2. 🚨 Padronização Global (Fix de Master para Main) 🚨

### Comando para configurar `main` como padrão definitivo:
Execute este comando **uma vez** no seu terminal para que todo novo projeto já nasça como `main`:
```bash
git config --global init.defaultBranch main
```

### Como mudar de `master` para `main` em um projeto já existente:
```bash
git branch -m master main
```

---

## 3. Trabalhando com Branches (Funcionalidades)

Usar branches permite que você trabalhe em novas funções sem estragar o código que já está funcionando na `main`.

### Criar uma nova branch e entrar nela:
```bash
# O nome deve ser curto e descritivo (ex: feat-relatorios)
git checkout -b nome-da-nova-branch
```

### Voltar para a `main`:
```bash
git checkout main
```

---

## 4. Como fazer Merge (Unir o código)

Quando terminar o trabalho na sua branch e quiser levar as mudanças para a `main`, siga estes passos:

### Passo 1: Salve tudo na sua branch atual
```bash
git add .
git commit -m "feat: finaliza nova funcionalidade"
git push origin nome-da-sua-branch
```

### Passo 2: Vá para a `main` e atualize-a
```bash
git checkout main
git pull origin main
```

### Passo 3: Una as branches (Merge)
```bash
git merge nome-da-sua-branch
```

### Passo 4: Envie a `main` atualizada para o servidor
```bash
git push origin main
```

---

## 5. Ciclo Diário Recomendado (Fluxo Simples)

Se estiver trabalhando direto na **`main`**:

```bash
# 1. Atualizar
git pull origin main

# 2. Alterar o código

# 3. Add e Commit
git add .
git commit -m "tipo: descrição curta"

# 4. Enviar
git push origin main
```

---

## 6. Guia de Implantação (Deployment)

### Passo 1: Gerar o Build de Produção
```bash
npm run build
```

### Passo 2: Sincronizar com o Servidor
```bash
git add .
git commit -m "deploy: atualiza sistema para nova versão"
git push origin main
```

---

## 7. Referência de Comandos Úteis

| Comando | Descrição |
| :--- | :--- |
| `git status` | Verifica o estado dos arquivos modificados. |
| `git branch` | Lista todas as branches e mostra em qual você está. |
| `git log --oneline -n 10` | Mostra os últimos 10 commits. |

---
*Este documento é o padrão de versionamento para o projeto RJR-oleo.*
