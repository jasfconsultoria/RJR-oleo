# Guia de Git e Implantação - RJR-oleo

Este guia centraliza as melhores práticas para o desenvolvimento, versionamento e deploy do projeto RJR-oleo.

## 1. 🚨 RESOLUÇÃO DE PROBLEMAS (FIX FINAL) 🚨

Se você tentou dar `push` e deu **erro de "rejected"** ou **"fetch first"**, é porque o GitHub tem alterações que você não tem no seu computador. Siga estes passos para sincronizar tudo:

### Passo 1: Corrigir o nome do servidor (se ainda não fez)
```bash
git remote rename master origin
```

### Passo 2: Puxar as alterações do servidor e mesclar com as suas
Este comando baixa o que está no GitHub e coloca os seus novos commits "em cima".
```bash
git pull origin main --rebase
```

### Passo 3: Enviar tudo para o GitHub
```bash
git push -u origin main
```

---

## 2. Fluxo de Trabalho (GitHub Best Practices)

Sempre use a branch `main` como referência.

### Ciclo Completo de Trabalho Diário
Estes são os comandos que você usará 99% do tempo:

```bash
# 1. Puxar alterações (SEMPRE faça isso ao começar)
git pull origin main

# 2. Desenvolver e fazer suas alterações

# 3. Adicionar mudanças para o commit
git add .

# 4. Criar o ponto de salvamento (Commit)
git commit -m "feat: descrição da sua mudança"

# 5. Enviar para o Servidor
git push origin main
```

## 3. Guia de Implantação (Deployment)

### Passo 1: Gerar o Build de Produção
```bash
npm run build
```

### Passo 2: Enviar para Produção
Após o build, você deve comitar o que foi gerado na pasta `dist`.
```bash
git add .
git commit -m "deploy: versão atualizada"
git push origin main
```

## 4. Referência de Comandos

| Comando | Função |
| :--- | :--- |
| `git remote -v` | Verifica o link com o GitHub. |
| `git branch` | Mostra se você está na `main`. |
| `git status` | Mostra arquivos modificados. |
| `git log --oneline` | Histórico de commits. |

---
*Criado para auxiliar o fluxo de trabalho do projeto RJR-oleo.*
