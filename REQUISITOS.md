# 🧭 Decisões de requisitos: versão definitiva

Este documento reúne as decisões tomadas para reconstruir o **Controle Financeiro Anual** de forma mais robusta. O ponto de partida é o protótipo `Prototype/controle_financeiro_FINAL.html`, descrito no [`README.md`](README.md).

**Como usar:** cada pergunta tem um campo **Decisão** e um **Status** (⏳ *Pendente* / ✅ *Decidido*). Decisões que mudarem depois devem ser registradas no [Histórico de decisões](#-histórico-de-decisões).

---

## Resumo

| Bloco | Tema | Decididas | Pendentes |
|---|---|---|---|
| A | Plataforma e infraestrutura | 4 | 0 |
| B | Modelo financeiro | 8 | 0 |
| C | Funcionalidades novas | 4 | 0 |
| D | Dados e migração | 2 | 0 |
| E | Interface | 4 | 0 |
| F | Stack técnica | 6 | 0 |

### Visão geral da versão definitiva

> App web **Next.js (TypeScript)** hospedado na **Vercel**, com dados no **Supabase** (Postgres + Auth). Uso **individual com login (e-mail e senha)**, acessível e sincronizado entre **PC e celular**. Categorias e subcategorias cadastráveis, lançamentos com **data completa** e status **pago/recebido**, recorrências com várias frequências e dia de vencimento, orçamento mensal simples por categoria e novos relatórios. Somente BRL. Sem contas/cartões, sem investimentos, sem importação de extratos nesta versão.

---

## A. Plataforma e infraestrutura 🔴 *crítico*

### A1. Em quais dispositivos o sistema será usado?
- **Status:** ✅ Decidido
- **Decisão:** **PC e celular, com dados sincronizados.** O layout deve ser responsivo e funcionar bem no celular.

### A2. Onde os dados vão ficar?
- **Status:** ✅ Decidido
- **Decisão:** **Nuvem gerenciada: Supabase** (Postgres + Auth). O backup automático fica a cargo do Supabase, e a exportação manual continua existindo (ver D2).

### A3. Haverá mais de um usuário? Precisa de login?
- **Status:** ✅ Decidido
- **Decisão:** **Uso individual, com login.** Todo dado pertence a um usuário (`user_id`) e fica isolado por Row Level Security.

### A4. Qual tecnologia usar? Quem vai manter o código?
- **Status:** ✅ Decidido
- **Decisão:** **Next.js (Node), com deploy na Vercel.** Detalhes da stack no bloco F.

---

## B. Modelo financeiro 🔴 *crítico*

### B1. As categorias são fixas ou cadastráveis?
- **Status:** ✅ Decidido
- **Decisão:** **Cadastro editável de categorias com subcategorias** (ex.: Moradia > Aluguel, Luz). A natureza (receita ou despesa) é um atributo da categoria. A subcategoria substitui o antigo "item" em texto livre (renomear e mesclar continuam previstos).

### B2. Separar previsto de realizado?
- **Status:** ✅ Decidido
- **Decisão:** **Status pago/recebido por lançamento.** Isso permite distinguir o que já foi efetivado e alimenta o relatório de contas a vencer (C3).

### B3. Controlar contas, cartões e parcelamentos?
- **Status:** ✅ Decidido
- **Decisão:** **Não.** Os lançamentos não ficam ligados a contas nem a cartões.

### B4. O saldo deve passar de um período para o seguinte?
- **Status:** ✅ Decidido
- **Decisão:** **Não.** Como no protótipo, o "Saldo acumulado no ano" recomeça em janeiro e cada ano é independente.

### B5. Investimentos
- **Status:** ✅ Decidido
- **Decisão:** **Totalmente fora do escopo.** Não haverá nenhuma estrutura de investimentos: nem tabela, nem campo arquivado, nem seção no backup.

### B6. O modelo de recorrência atual atende?
- **Status:** ✅ Decidido
- **Decisão:** manter o modelo do protótipo (série como regra com início, fim opcional e exceções) e acrescentar:
  - **outras frequências**: semanal, mensal, bimestral, trimestral, semestral e anual;
  - **dia de vencimento**: a série gera ocorrências numa data definida (ex.: todo dia 10);
  - **edição de uma ocorrência**: ao editar um lançamento de uma série, o app pergunta se a mudança vale **só para esse lançamento** (**padrão**) ou **dele em diante**. Nesse segundo caso a série é dividida e o passado é preservado. A opção de alterar a série inteira continua disponível.
- **Fora desta versão:** reajuste automático e aviso de fim de série.

### B7. Os lançamentos precisam de data exata (dia)?
- **Status:** ✅ Decidido
- **Decisão:** **Data completa (dia/mês/ano).** A grade anual continua agrupando por mês.

### B8. Só real (BRL), ou várias moedas?
- **Status:** ✅ Decidido
- **Decisão:** **Só BRL.** Os valores continuam guardados em centavos inteiros.

---

## C. Funcionalidades novas

### C1. Importar extratos bancários?
- **Status:** ✅ Decidido
- **Decisão:** **Não, por enquanto.** Pode ser reavaliado numa versão futura.

### C2. Orçamento ou metas por categoria?
- **Status:** ✅ Decidido
- **Decisão:** **Limite mensal simples por categoria.** O app mostra o limite e quanto já foi usado, sem alertas.

### C3. Quais relatórios e gráficos fazem falta?
- **Status:** ✅ Decidido
- **Decisão:** além do dashboard atual (cards e gráfico de despesas × receita por mês), incluir:
  - despesas por categoria, com detalhamento por subcategoria;
  - comparação entre anos;
  - maiores gastos do período;
  - contas a vencer (lançamentos não pagos, próximos do vencimento ou atrasados).

### C4. Anexos e observações nos lançamentos?
- **Status:** ✅ Decidido
- **Decisão:** **Só um campo de observação** (texto livre opcional). Sem anexos.

---

## D. Dados e migração

### D1. Há dados reais no protótipo para migrar?
- **Status:** ✅ Decidido
- **Decisão:** **Não. A nova versão começa do zero**, sem importador de dados do protótipo.

### D2. Manter exportação para CSV/Excel e backup por arquivo?
- **Status:** ✅ Decidido
- **Decisão:** **Manter as duas coisas:** backup completo em `.json` (exportar e restaurar) e exportação de CSV para o Excel.

---

## E. Interface

### E1. A grade anual continua sendo a tela principal?
- **Status:** ✅ Decidido
- **Decisão:** **Grade anual e visão em lista.** A grade estilo planilha (com edição por modal) continua. Junto dela, uma lista/extrato do mês com filtros e marcação de pago, que é a visão principal no celular.

### E2. Tema visual
- **Status:** ✅ Decidido
- **Decisão:** **Segue o tema do sistema operacional**, com botão para alternar entre claro e escuro.

### E3. Organização em telas
- **Status:** ✅ Decidido (validado no protótipo). Abas separadas para **Lançamentos**, **Dashboard** e **Dados e backup**. Entram também as telas de cadastro de categorias, orçamento e relatórios.

### E4. Dashboard em tela própria
- **Status:** ✅ Decidido (validado no protótipo). O Dashboard fica separado da grade, com os cards de resumo ao lado do gráfico em telas largas.

---

## F. Stack técnica

| # | Tema | Decisão |
|---|---|---|
| F1 | Linguagem e framework | **TypeScript + Next.js (App Router)**, deploy na **Vercel** |
| F2 | Autenticação | **Supabase Auth com e-mail e senha** (com recuperação de senha) |
| F3 | Acesso ao banco | **Drizzle ORM + Server Actions**. Schema e migrações versionados no repositório, regras de negócio no servidor e **RLS** no Supabase como segunda camada de segurança |
| F4 | Interface | **Tailwind CSS + shadcn/ui**, com gráficos em **Recharts** |
| F5 | Testes | **Só unitários (Vitest)**, focados na lógica de domínio: recorrências, saldos e centavos |
| F6 | Ambiente de desenvolvimento | **Tudo local primeiro**: Next.js em `localhost` e **Supabase CLI local** (Docker Desktop), com Postgres, Auth, Mailpit e Studio. O deploy na Vercel e no Supabase na nuvem só acontece depois de validar localmente; a troca é feita apenas pelas variáveis de ambiente |

---

## 📌 Lacunas do protótipo (para referência)

| Limitação | Decisão relacionada | Tratamento |
|---|---|---|
| Dados presos a um navegador e um computador | A1, A2 | Resolvido: Supabase |
| Um único usuário, sem login | A3 | Resolvido: login individual |
| Categorias fixas; item é texto livre | B1 | Resolvido: categorias e subcategorias |
| Sem previsto × realizado | B2 | Resolvido: status pago/recebido |
| Sem contas, cartões ou parcelamentos | B3 | Mantido (fora do escopo) |
| O saldo não passa de um ano para o outro | B4 | Mantido (decisão) |
| Granularidade mensal (sem dia) | B7 | Resolvido: data completa |
| Apenas BRL | B8 | Mantido (decisão) |
| Sem importação de extrato bancário | C1 | Mantido (futuro) |
| Sem orçamento ou metas | C2 | Resolvido: limite mensal simples |
| Sem anexos ou observações | C4 | Resolvido: campo de observação |
| Sem testes automatizados | F5 | Resolvido: testes unitários |

---

## 🕓 Histórico de decisões

| Data | Decisão | Observação |
|---|---|---|
| 2026-11-08 | B5: Investimentos fora do escopo | Removidos do protótipo; dados antigos arquivados |
| 2026-11-08 | E3: Abas Lançamentos / Dashboard / Dados e backup | Validado no protótipo final |
| 2026-11-08 | E4: Dashboard em tela própria | Validado no protótipo final |
| 2026-11-14 | A1–A4: PC + celular, Supabase, login individual, Next.js na Vercel | |
| 2026-11-14 | B1–B4, B6–B8: categorias cadastráveis, status pago, sem contas, saldo anual, recorrência estendida, data completa, só BRL | |
| 2026-11-14 | B5 revisado: investimentos removidos por completo | Nenhuma estrutura nem arquivamento no backup |
| 2026-11-14 | C1–C4: sem extratos, limite mensal simples, 4 novos relatórios, campo de observação | |
| 2026-11-14 | D1–D2: começar do zero; backup .json + CSV | |
| 2026-11-14 | E1–E2: grade anual + lista; tema do sistema + alternância | |
| 2026-11-14 | F1–F5: TypeScript/Next.js, Supabase Auth (e-mail/senha), Drizzle + Server Actions, Tailwind + shadcn/ui, Vitest | |
| 2026-11-14 | F6: desenvolvimento 100% local (Supabase CLI + Docker) antes de Vercel/Supabase na nuvem | |
