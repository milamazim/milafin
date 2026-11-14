# 🧭 Decisões de requisitos: versão definitiva

Este documento reúne as decisões que ainda precisam ser tomadas para reconstruir o **Controle Financeiro Anual** de forma mais robusta. O ponto de partida é o protótipo `Prototype/controle_financeiro_FINAL.html`, descrito no [`README.md`](README.md).

**Como usar:** para cada pergunta, preencha o campo **Decisão** e mude o **Status** de ⏳ *Pendente* para ✅ *Decidido*. Decisões que mudarem depois devem ser registradas no [Histórico de decisões](#-histórico-de-decisões).

**Prioridade:** os blocos **A** (plataforma) e **B** (modelo financeiro) definem a arquitetura e o modelo de dados. Eles precisam ser decididos **antes** de começar o desenvolvimento. Os demais blocos podem seguir padrões razoáveis e ser ajustados depois.

---

## Resumo

| Bloco | Tema | Decididas | Pendentes |
|---|---|---|---|
| A | Plataforma e infraestrutura | 0 | 4 |
| B | Modelo financeiro | 1 | 7 |
| C | Funcionalidades novas | 0 | 4 |
| D | Dados e migração | 0 | 2 |
| E | Interface | 2 | 2 |

---

## A. Plataforma e infraestrutura 🔴 *crítico*

### A1. Em quais dispositivos o sistema será usado?
- **Opções:** só PC · só celular · PC e celular com dados sincronizados
- **Impacto:** define se precisa de sincronização, de layout para celular como prioridade e de PWA ou app nativo.
- **Situação no protótipo:** funciona em qualquer navegador, mas os dados ficam presos a um único navegador.
- **Status:** ⏳ Pendente
- **Decisão:**

### A2. Onde os dados vão ficar?
- **Opções:** 100% local (navegador ou arquivo) · nuvem gerenciada (Supabase, Firebase…) · servidor próprio (VPS)
- **Impacto:** privacidade, custo, backup automático, acesso de vários dispositivos.
- **Situação no protótipo:** `localStorage` do navegador, com backup manual em `.json`.
- **Status:** ⏳ Pendente
- **Decisão:**

### A3. Haverá mais de um usuário? Precisa de login?
- **Opções:** uso individual sem login · individual com login · compartilhado (ex.: casal ou família), com ou sem permissões diferentes
- **Impacto:** autenticação, modelo de dados com dono ou compartilhamento, conflitos de edição.
- **Situação no protótipo:** um único usuário, sem login.
- **Status:** ⏳ Pendente
- **Decisão:**

### A4. Qual tecnologia usar? Quem vai manter o código?
- **Opções:** web SPA (React, Vue, Svelte) · full-stack (Next.js, Django…) · desktop (Tauri, Electron) · sem preferência (recomendação técnica)
- **Impacto:** curva de manutenção, hospedagem, possibilidade de app para celular.
- **Situação no protótipo:** um único HTML com JavaScript puro, sem dependências.
- **Status:** ⏳ Pendente
- **Decisão:**

---

## B. Modelo financeiro 🔴 *crítico*

### B1. As categorias são fixas ou cadastráveis?
- **Opções:** manter os 3 tipos fixos · cadastro editável de categorias (ex.: Moradia) com subcategorias (ex.: Aluguel, Luz)
- **Impacto:** estrutura da grade, relatórios por categoria, orçamento (C2).
- **Situação no protótipo:** 3 tipos fixos (Receita, Despesa recorrente, Despesa esporádica). O "item" é texto livre, com sugestões e a opção renomear/mesclar.
- **Status:** ⏳ Pendente
- **Decisão:**

### B2. Separar previsto de realizado?
- **Opções:** não · marcar cada lançamento como pago/recebido · valores previsto e realizado separados, com a diferença entre eles
- **Impacto:** campos de status, saldo projetado × saldo real, alertas de contas a vencer.
- **Situação no protótipo:** não existe. Todo lançamento conta como efetivado.
- **Status:** ⏳ Pendente
- **Decisão:**

### B3. Controlar contas, cartões e parcelamentos?
- **Opções:** não · contas (corrente, poupança, carteira) · e também cartão de crédito com fatura, fechamento e vencimento · e também compras parceladas
- **Impacto:** é a mudança mais significativa no modelo de dados (lançamento ligado a conta ou cartão, transferências entre contas, faturas).
- **Situação no protótipo:** não existe.
- **Status:** ⏳ Pendente
- **Decisão:**

### B4. O saldo deve passar de um período para o seguinte?
- **Opções:** não (como hoje) · passa de um ano para o outro · saldo inicial por conta, com saldo corrente (depende de B3)
- **Impacto:** cálculo de saldo, tela de saldo inicial, conciliação.
- **Situação no protótipo:** existe o "Saldo acumulado no ano", que recomeça em janeiro.
- **Status:** ⏳ Pendente
- **Decisão:**

### B5. Investimentos
- **Status:** ✅ Decidido. **Fora do escopo** por ora (removidos do protótipo). Os dados antigos ficam arquivados e preservados no backup.
- **Pendente de confirmação:** voltam no futuro? Se sim, com qual nível de detalhe (só aportes; aportes, resgates e rendimentos; saldo por ativo ou corretora)?

### B6. O modelo de recorrência atual atende?
- **Situação no protótipo:**
  - série com início e fim, ou sem fim;
  - exceções por mês;
  - edição "só este mês", "deste mês em diante" (preserva o passado) ou "toda a série".
- **Pontos a decidir:**
  - outras frequências (semanal, bimestral, anual)?
  - reajuste automático (ex.: +x% ao ano)?
  - aviso quando uma série está perto do fim?
- **Status:** ⏳ Pendente
- **Decisão:**

### B7. Os lançamentos precisam de data exata (dia)?
- **Opções:** só o mês basta · data completa (dia/mês/ano) · data de competência e data de pagamento separadas
- **Impacto:** ordenação, vencimentos, fatura do cartão (B3), importação de extrato (C1).
- **Situação no protótipo:** só o mês.
- **Status:** ⏳ Pendente
- **Decisão:**

### B8. Só real (BRL), ou várias moedas?
- **Opções:** só BRL · várias moedas com conversão
- **Impacto:** campo de moeda, cotações, relatórios consolidados.
- **Situação no protótipo:** só BRL.
- **Status:** ⏳ Pendente
- **Decisão:**

---

## C. Funcionalidades novas

### C1. Importar extratos bancários?
- **Opções:** não · OFX · CSV do banco (com mapeamento de colunas) · integração automática (Open Finance)
- **Impacto:** depende de B7 (data com dia) e de regras de categorização automática.
- **Situação no protótipo:** só importa o CSV no formato do próprio app.
- **Status:** ⏳ Pendente
- **Decisão:**

### C2. Orçamento ou metas por categoria?
- **Opções:** não · limite mensal por categoria · com alertas ao se aproximar do limite ou ultrapassá-lo
- **Impacto:** depende de B1 (categorias cadastráveis).
- **Status:** ⏳ Pendente
- **Decisão:**

### C3. Quais relatórios e gráficos fazem falta?
- **Sugestões:**
  - despesas por categoria (pizza ou treemap);
  - comparação entre anos;
  - evolução do saldo ou patrimônio;
  - maiores gastos do período.
- **Situação no protótipo:** cards de receitas, despesas e saldo do ano, e gráfico de despesas × receita por mês.
- **Status:** ⏳ Pendente
- **Decisão:**

### C4. Anexos e observações nos lançamentos?
- **Opções:** não · campo de observação · anexos (comprovantes, notas fiscais)
- **Impacto:** anexos exigem armazenamento de arquivos, o que pesa na decisão A2.
- **Status:** ⏳ Pendente
- **Decisão:**

---

## D. Dados e migração

### D1. Há dados reais no protótipo para migrar?
- **Caminho previsto:** o backup `.json` v2 (aba *Dados e backup*) é o formato de origem da migração.
- **Status:** ⏳ Pendente
- **Decisão:**

### D2. Manter exportação para CSV/Excel e backup por arquivo?
- **Opções:** manter ambos · só exportação (se houver backup automático na nuvem) · exportação em `.xlsx` nativo
- **Status:** ⏳ Pendente
- **Decisão:**

---

## E. Interface

### E1. A grade anual continua sendo a tela principal?
- **Pontos a decidir:**
  - manter a grade estilo planilha?
  - editar valores direto na célula, sem abrir modal?
  - incluir uma visão em lista ou extrato?
- **Status:** ⏳ Pendente
- **Decisão:**

### E2. Tema visual
- **Opções:** escuro fixo (como hoje) · alternância claro/escuro · seguir o sistema operacional
- **Status:** ⏳ Pendente
- **Decisão:**

### E3. Organização em telas
- **Status:** ✅ Decidido (validado no protótipo). Abas separadas para **Lançamentos**, **Dashboard** e **Dados e backup**.

### E4. Dashboard em tela própria
- **Status:** ✅ Decidido (validado no protótipo). O Dashboard fica separado da grade, com os cards de resumo ao lado do gráfico em telas largas.

---

## 📌 Lacunas do protótipo (para referência)

Cada limitação do protótipo atual se liga a uma decisão acima:

| Limitação | Decisão relacionada |
|---|---|
| Dados presos a um navegador e um computador | A1, A2 |
| Um único usuário, sem login | A3 |
| Categorias fixas; item é texto livre | B1 |
| Sem previsto × realizado | B2 |
| Sem contas, cartões ou parcelamentos | B3 |
| O saldo não passa de um ano para o outro | B4 |
| Granularidade mensal (sem dia) | B7 |
| Apenas BRL | B8 |
| Sem importação de extrato bancário | C1 |
| Sem orçamento ou metas | C2 |
| Sem anexos ou observações | C4 |
| Sem testes automatizados de interface | (definir junto com A4) |

---

## 🕓 Histórico de decisões

| Data | Decisão | Observação |
|---|---|---|
| 2026-11-08 | B5: Investimentos fora do escopo | Removidos do protótipo; dados antigos arquivados |
| 2026-11-08 | E3: Abas Lançamentos / Dashboard / Dados e backup | Validado no protótipo final |
| 2026-11-08 | E4: Dashboard em tela própria | Validado no protótipo final |
