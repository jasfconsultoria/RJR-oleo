# Guia de Git para o Projeto RJR-oleo

Este guia explica como configurar sua identidade no Git e como seguir o fluxo de trabalho na branch `main`.

## 1. Configuração Inicial (Identidade)

Se você recebeu o erro `fatal: unable to auto-detect email address`, execute os comandos abaixo substituindo pelos seus dados:

```bash
git config --global user.email "seu-email@exemplo.com"
git config --global user.name "Seu Nome"
```

> [!TIP]
> Use `--global` para aplicar a todos os seus projetos ou remova para configurar apenas neste repositório.

## 2. Mudando de `master` para `main`

Se o seu repositório ainda usa `master` e você deseja mudar para `main`:

```bash
# Renomear a branch localmente
git branch -m master main

# Se já houver um remote (GitHub/GitLab), atualize-o
# git push -u origin main
```

## 3. Fluxo de Trabalho na Branch `main`

Sempre siga estes passos para manter o código atualizado e seguro:

### Passo 1: Atualizar seu código local
Antes de começar qualquer trabalho, puxe as últimas mudanças do servidor:
```bash
git pull origin main
```

### Passo 2: Adicionar suas alterações
Após fazer as modificações, adicione os arquivos ao "stage":
```bash
# Adicionar tudo
git add .

# Ou adicionar um arquivo específico
git add caminho/do/arquivo.js
```

### Passo 3: Criar um Commit
Grave suas alterações com uma mensagem clara:
```bash
git commit -m "Explique o que você fez aqui"
```

### Passo 4: Enviar para o servidor (Push)
Envie suas alterações locais para a branch `main` no servidor:
```bash
git push origin main
```

## 4. Comandos Úteis

- `git status`: Verifica quais arquivos foram modificados.
- `git log --oneline -n 10`: Mostra os últimos 10 commits de forma resumida.
- `git diff`: Mostra as diferenças exatas que ainda não foram adicionadas ao commit.

---
*Criado automaticamente para auxiliar no desenvolvimento do projeto RJR-oleo.*
