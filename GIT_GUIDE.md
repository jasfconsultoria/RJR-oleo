# Guia de Git e Implantação - RJR-oleo

Este guia centraliza as melhores práticas para o desenvolvimento, versionamento e deploy do projeto RJR-oleo.

## 1. Configuração de Identidade

Mantenha sua identidade configurada para que os commits fiquem registrados em seu nome:

```bash
git config --global user.email "jasfconsultoria@gmail.com"
git config --global user.name "Seu Nome"
```

---

## 2. Fluxo de Trabalho Integrado (GitHub)

Sempre utilize a branch **`main`** como referência para desenvolvimento e produção.

### Ciclo Diário Recomendado:

```bash
# 1. Atualizar seu código local com o servidor
git pull origin main

# 2. Desenvolver suas tarefas e melhorias

# 3. Adicionar arquivos modificados
git add .

# 4. Gravar suas alterações (Commit)
git commit -m "tipo: descrição curta do que foi feito"

# 5. Enviar para o servidor (GitHub)
git push origin main
```

> [!TIP]
> Use prefixos nos commits para melhor organização: `feat:` para novas funções, `fix:` para correções, `deploy:` para atualizações de versão.

---

## 3. Guia de Implantação (Deployment)

Para levar as alterações para o ambiente de produção, siga estes passos:

### Passo 1: Gerar o Build de Produção
O comando abaixo gera os arquivos otimizados na pasta `dist/`.
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

## 4. Referência de Comandos Úteis

| Comando | Descrição |
| :--- | :--- |
| `git status` | Verifica o estado dos arquivos (quais foram alterados). |
| `git pull origin main` | Puxa e mescla as últimas mudanças do servidor. |
| `git log --oneline -n 10` | Mostra os últimos 10 commits de forma resumida. |
| `git remote -v` | Mostra os endereços dos servidores remotos configurados. |

---
*Este documento é o padrão de versionamento para o projeto RJR-oleo.*
