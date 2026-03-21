# Relatório de Auditoria de Estoque - Março 2026

Este documento detalha o cruzamento de dados entre o módulo de **Coletas** e o **Relatório de Estoque** para o período de 01/03/2026 a 31/03/2026.

## 📊 Resumo Executivo

| Item | Valor / Quantidade | Observação |
| :--- | :---: | :--- |
| Total de Coletas de Troca | 52 | Registradas no sistema |
| Coletas com Saída de Estoque | 49 | Saída automática gerada pós-assinatura |
| **Coletas SEM Saída de Estoque** | **3** | **Aguardando assinatura do recibo** |
| Total de Saídas em Estoque | 50 | Total de registros no relatório |
| Saídas Manuais | 1 | Ajuste de estoque (362 unidades) |

---

## 🔍 Coletas sem Saída de Estoque

As 3 coletas abaixo ainda não geraram saída de estoque porque seus recibos estão com status **"Pendente"** ou **"Aguardando Assinatura"**. O sistema só registra a saída de óleo novo no estoque no momento em que o recibo é assinado.

| Nº Coleta | Data | Qtd. Entrega | Status Atual |
| :--- | :--- | :---: | :--- |
| **000581** | 11/03/2026 | 28,00 | Aguardando Assinatura |
| **000600** | 11/03/2026 | 24,00 | Aguardando Assinatura |
| **000697** | 21/03/2026 | 24,00 | Aguardando Assinatura |
| **TOTAL** | | **76,00** | |

---

## ⚖️ Explicação da Diferença de Volume (1199 vs 913)

Houve uma dúvida sobre o motivo de existirem **1199 saídas** no relatório contra apenas **913 unidades** nas coletas. A conta fecha da seguinte forma:

1. **Volume em Coletas (913.00):** É a soma das 52 coletas de troca realizadas no mês.
2. **Volume em Saídas Automáticas (837.00):** Corresponde às 49 coletas que já foram assinadas (913 total - 76 pendentes = 837).
3. **Volume em Saídas Manuais (362.00):** Existe uma saída manual no dia 20/03/2026 referente a um **AJUSTE DE ESTOQUE** (Nº Doc 032026).

### Cálculo Final:
- **837.00** (Saídas de Coletas Assinadas)
- **+ 362.00** (Ajuste Manual de Estoque)
- **= 1199.00** (Total exibido no Relatório de Estoque)

---

## ✅ Conclusão
A auditoria confirma que a integridade dos dados está mantida. As coletas que "fantam" no estoque são apenas as que ainda não tiveram o processo de assinatura concluído. Assim que os recibos 581, 600 e 697 forem assinados, as saídas de 28, 24 e 24 unidades serão lançadas automaticamente, equalizando o saldo.
