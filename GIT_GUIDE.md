# Guia de Git e Implantação - RJR-oleo

Este guia centraliza as melhores práticas para o desenvolvimento, versionamento e deploy do projeto RJR-oleo.

## 1. Configuração de Identidade

Se você ainda não configurou seu usuário, execute os comandos abaixo no terminal:

```bash
git config --global user.email "jasfconsultoria@gmail.com"
git config --global user.name "Seu Nome"
```

## 2. Fluxo de Trabalho (GitHub Best Practices)

Seguir um fluxo organizado evita conflitos de código e facilita o rastreamento de mudanças.

### Boas Práticas Diárias
1.  **Sempre comece com `git pull`**: Antes de iniciar qualquer alteração, garanta que sua branch local está atualizada com o servidor.
    ```bash
    git pull origin main
    ```
2.  **Commits Pequenos e Frequentes**: Evite fazer commits gigantescos. Divida o trabalho em partes lógicas.
3.  **Mensagens de Commit Claras**: Use mensagens que descrevam o "porquê" da mudança.
    *   *Exemplo:* `feat: adiciona campo de centro de custo obrigatório no financeiro`

### Ciclo de Desenvolvimento
```bash
# 1. Puxe as atualizações
git pull origin main

# 2. Faça suas alterações no código

# 3. Adicione e Comite
git add .
git commit -m "tipo: descrição curta da mudança"

# 4. Envie para o GitHub
git push origin main
```

## 3. Guia de Implantação (Deployment)

Para levar as alterações para o ambiente de produção, siga estes passos:

### Passo 1: Gerar o Build de Produção
O comando de build compila o código React/Vite para arquivos estáticos otimizados.
```bash
npm run build
```

### Passo 2: Verificar a Pasta `dist`
Após o build, uma pasta chamada `dist` será atualizada na raiz do projeto. Estes são os arquivos que devem ser enviados ao servidor ou serviço de hospedagem.

### Passo 3: Comitar e Enviar
Se o deploy for automatizado via GitHub Actions ou similar ao dar push na `main`:
```bash
git add .
git commit -m "deploy: atualiza sistema para versão X.Y.Z"
git push origin main
```

## 4. Comandos Úteis de Referência

| Comando | Descrição |
| :--- | :--- |
| `git status` | Lista arquivos modificados e prontos para commit. |
| `git log --oneline` | Mostra o histórico de commits de forma resumida. |
| `git diff` | Mostra as alterações exatas feitas nos arquivos. |
| `git checkout -b <nome>` | Cria uma nova branch para uma funcionalidade específica. |

---
*Este documento deve ser mantido atualizado conforme novas ferramentas de deploy forem integradas.*
