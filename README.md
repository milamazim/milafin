# 💰 milafin: controle de finanças pessoais

App web para controlar receitas e despesas pessoais, com lançamentos recorrentes, grade anual estilo planilha, dashboard, relatórios e orçamento por categoria. Funciona no computador e no celular, com os dados sincronizados na nuvem.

> As decisões de produto e de tecnologia estão registradas em [`REQUISITOS.md`](REQUISITOS.md).

## Sumário

- [Funcionalidades](#-funcionalidades)
- [Conceitos](#-conceitos)
- [Formatos de arquivo](#-formatos-de-arquivo)
- [Tecnologia](#-tecnologia)
- [Desenvolvimento local](#-desenvolvimento-local)
- [Estrutura do código](#-estrutura-do-código)
- [Segurança](#-segurança)
- [Testes](#-testes)

---

## ✨ Funcionalidades

### 🔐 Conta
- Cadastro com **e-mail e senha** (mínimo de 8 caracteres, com letras e números) e confirmação por e-mail.
- Recuperação de senha por link enviado ao e-mail.
- Cada pessoa vê **apenas os próprios dados**.

### 🏷 Categorias
- Categorias de **receita** ou **despesa**, com **subcategorias** (ex.: Moradia › Aluguel, Luz).
- **Conjunto sugerido** para começar rápido: Renda, Moradia, Alimentação, Transporte, Saúde e Lazer.
- Renomear, **arquivar** (some dos cadastros e mantém o histórico), excluir (só sem uso) e **mesclar** categorias duplicadas.
- **Limite mensal** por categoria de despesa, para acompanhar o orçamento.

### 📋 Lançamentos
- **Grade anual**, a visão padrão no computador:
  - meses nas colunas e categorias nas linhas, com subtotais, **saldo do mês** e **saldo acumulado no ano**;
  - alterna entre **previsto** (tudo) e **realizado** (só o que foi pago);
  - clicar numa célula mostra os lançamentos dela para editar ou adicionar.
- **Lista do mês**, a visão padrão no celular:
  - resumo do mês, filtros (a pagar, pagos) e **checkbox para marcar como pago**;
  - selo **Atrasado** nas contas vencidas.
- **Lançamento avulso** ou **recorrente**:
  - frequência semanal, mensal, bimestral, trimestral, semestral ou anual;
  - dia de vencimento e data final opcional.
- **Observação** opcional em cada lançamento.
- Ao editar ou excluir uma ocorrência recorrente, você escolhe o alcance: **só este** (padrão), **deste em diante** ou **toda a série**.
- **Marcar anteriores a hoje como pagas:** para quem começa a usar o app com séries já em andamento.
- A aba, o mês e o ano ficam no endereço da página, então sobrevivem a recarregar e podem ser compartilhados.

### 📊 Dashboard
- Receitas, despesas e saldo do ano, com o previsto e o realizado.
- Gráficos de **receitas e despesas por mês** e de **saldo do mês** (quanto sobrou ou faltou), com alternativa em tabela.
- **Orçamento do mês:** um medidor por categoria com limite, mostrando "Restam R$ X", "Perto do limite" ou "Estourou R$ X".
- **Contas a pagar:** atrasadas e dos próximos 7 dias.

### 📈 Relatórios
- **Contas a vencer:** atrasadas e dos próximos 30 dias, com opção de marcar como pago na própria lista.
- **Despesas por categoria:** barras ordenadas da maior para a menor, com percentual e detalhamento por subcategoria.
- **Maiores gastos** do período.
- **Comparação com o ano anterior**, mês a mês, para despesas, receitas ou saldo.
- Filtro por ano e por mês (ou o ano inteiro).

### 💾 Dados e backup
- **Backup completo em `.json`:** categorias, séries e lançamentos.
- **Restaurar backup**, com prévia do conteúdo antes de aplicar:
  - **Mesclar** (padrão): acrescenta o que falta, sem apagar nem duplicar;
  - **Substituir tudo**: deixa a conta igual ao backup.
- **Exportar para Excel (CSV):** um arquivo por ano.
- **Apagar todos os dados**, com confirmação. A conta e o login continuam.

### 🎨 Interface
- Em português, com valores em reais (BRL).
- **Tema claro ou escuro:** segue o sistema e pode ser alternado no botão do topo.
- Responsiva: abas no topo a partir de tablet e **barra de abas inferior** no celular.
- Cores acessíveis: **receita em azul e despesa em vermelho**, par validado para daltonismo. Estados como "estourou" ou "atrasado" sempre vêm com ícone e texto, nunca só com cor.

---

## 🧠 Conceitos

### Valores
Todo valor é guardado em **centavos inteiros**, o que evita erros de arredondamento como `0,1 + 0,2 ≠ 0,3`. O campo de valor aceita `1.234,56`, `1234,56`, `1234.56` e `R$ 50`. Zero e valores negativos são recusados.

### Previsto × realizado
Cada lançamento tem o status **pago/recebido**. O **previsto** soma tudo, e o **realizado** soma só o que foi marcado como pago. O saldo acumulado recomeça em janeiro de cada ano.

### Séries recorrentes
Uma série é uma **regra**, não cópias do lançamento em cada mês. Ela tem:
- data inicial, que também define o **dia de vencimento**;
- frequência;
- data final, **ou sem fim** (nesse caso aparece em todos os anos futuros);
- datas **excluídas** (exceções).

As ocorrências são calculadas na hora de exibir. Um vencimento no dia 31 cai em 28/29 de fevereiro e volta a 31 em março.

**Editar uma ocorrência** com outros valores, ou marcá-la como paga, cria uma *substituição*: um lançamento ligado àquela data da série, que toma o lugar da ocorrência calculada. Os alcances funcionam assim:

| Alcance | Ao editar | Ao excluir |
|---|---|---|
| **Só este** (padrão) | Só esta ocorrência muda; a série continua igual | A data entra nas exclusões da série |
| **Deste em diante** | A série é **dividida**: a antiga termina antes desta data e uma nova começa com os novos dados (pode mudar a frequência). **O passado não muda**, como num reajuste de aluguel | A série passa a terminar antes desta data |
| **Toda a série** | Muda todas as ocorrências, inclusive as passadas; mudar a data desloca o vencimento da série inteira | Apaga a série |

Ocorrências editadas à mão (por exemplo, pagas ou com outro valor) são **sempre preservadas**: nunca recebem os novos valores da série.

### Categorias e lançamentos
Lançamentos vão para uma **subcategoria**, ou para uma categoria que não tenha subcategorias. Um lançamento feito direto numa categoria que depois ganhou subcategorias aparece na linha **"Geral"** da grade.

---

## 📄 Formatos de arquivo

### Backup `.json` (versão 1)

```jsonc
{
  "app": "milafin",
  "version": 1,
  "exportedAt": "2026-11-14T10:00:00.000Z",
  "counts": { "categories": 18, "recurrences": 4, "transactions": 120 },
  "data": {
    "categories":   [{ "id", "parentId", "name", "kind", "monthlyLimitCents", "sortOrder", "archivedAt" }],
    "recurrences":  [{ "id", "categoryId", "amountCents", "frequency", "startDate", "endDate", "excludedDates", "note" }],
    "transactions": [{ "id", "categoryId", "amountCents", "date", "paid", "note", "recurrenceId", "recurrenceDate" }]
  }
}
```

- Não contém o identificador do usuário: o backup passa a pertencer a quem o restaura.
- Na restauração, o arquivo é validado por inteiro: tipos, referências entre categorias, séries e lançamentos, e nomes repetidos. Tudo é aplicado numa única transação: se algo falhar, nada muda.
- **Mesclar** é idempotente: restaurar o mesmo arquivo duas vezes não muda nada na segunda vez. Categorias com o mesmo nome no mesmo lugar são juntadas.
- O arquivo pode ter até 3,5 MB.

### CSV (Excel)
- Um arquivo por ano: `financas_<ano>.csv`.
- Separador `;`, vírgula decimal, codificação UTF-8 com BOM: abre direto no Excel em português.
- Uma linha por lançamento, com as séries já expandidas.
- Textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo na frente para não serem executados como fórmula.

```
"Data";"Ano";"Mês";"Tipo";"Categoria";"Subcategoria";"Valor";"Pago";"Origem";"Observação"
"10/03/2026";"2026";"Mar";"Despesa";"Moradia";"Aluguel";"2800,00";"Sim";"Recorrente";""
```

---

## 🛠 Tecnologia

| Camada | Escolha |
|---|---|
| Framework | **Next.js 16** (App Router, Cache Components, Server Actions), **TypeScript** |
| Banco e login | **Supabase**: Postgres + Auth (e-mail e senha), com **Row Level Security** |
| Acesso ao banco | **Drizzle ORM**; o schema em TypeScript gera as migrações SQL |
| Interface | **Tailwind CSS 4** + **shadcn/ui** (Base UI); gráficos em **SVG próprio** |
| Testes | **Vitest** (regras de negócio e cálculos) |
| Hospedagem prevista | **Vercel** (app) + **Supabase** (banco) |

---

## 🚀 Desenvolvimento local

### Pré-requisitos
- **Node.js** 22 ou superior
- **Docker** em execução (Docker Desktop no Windows/macOS ou Docker Engine no Linux): o Supabase local roda em containers

### Primeira execução

```bash
npm install
npm run db:start      # sobe o Supabase local e aplica as migrações (na 1ª vez, baixa as imagens)
npm run env:local     # gera o .env.local com a URL, a chave e a conexão do banco local
npm run dev           # http://localhost:3000
```

Crie uma conta em `/cadastro`. Localmente, o e-mail de confirmação **não é enviado de verdade**: ele aparece no **Mailpit**.

| Serviço local | Endereço |
|---|---|
| App | http://localhost:3000 |
| Mailpit (e-mails de cadastro e senha) | http://127.0.0.1:54324 |
| Tabelas do banco (Drizzle Studio) | `npm run db:studio` → https://local.drizzle.studio |
| API do Supabase | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

> Para economizar memória, o painel web do Supabase (Studio) e os serviços não usados (realtime, storage, edge functions, analytics) estão desligados em `supabase/config.toml`.

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` / `npm run test:watch` | Testes unitários (Vitest) |
| `npm run typecheck` / `npm run lint` | Checagem de tipos e lint |
| `npm run build` | Build de produção |
| `npm run db:start` / `db:stop` / `db:status` | Liga, desliga e mostra o status do Supabase local |
| `npm run db:generate` | Gera uma migração SQL a partir de `src/db/schema.ts` |
| `npm run db:reset` | Recria o banco local aplicando todas as migrações (**apaga os dados locais**) |
| `npm run db:studio` | Abre o Drizzle Studio para ver e editar as tabelas |
| `npm run env:local` | Gera de novo o `.env.local` a partir do Supabase local |

### Variáveis de ambiente
Veja [`.env.example`](.env.example). Localmente, o `npm run env:local` preenche tudo. O arquivo `.env.local` não vai para o git.

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL da API do Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do Supabase (segura no navegador) |
| `DATABASE_URL` | Conexão direta com o Postgres, usada só no servidor (Drizzle) |

### Alterando o banco
1. Edite `src/db/schema.ts`.
2. Rode `npm run db:generate`. A migração é criada em `supabase/migrations/`.
3. Rode `npm run db:reset` para aplicá-la no banco local.

O schema é a fonte da verdade: não edite migrações já aplicadas. Mudanças em `supabase/config.toml` ou nos templates de e-mail (`supabase/templates/`) só valem depois de reiniciar o Supabase (`npm run db:stop` e `npm run db:start`). Os dados locais são preservados.

> **Dica:** se uma mudança de estilo (CSS) não aparecer no navegador, reinicie o `npm run dev`.

---

## 🗂 Estrutura do código

```
src/
  app/
    (auth)/            entrar, cadastro, esqueci-senha, redefinir-senha + Server Actions de login
    (app)/             área logada
      lancamentos/     grade anual, lista do mês, diálogo de lançamento, ações
      categorias/      cadastro de categorias e ações
      dashboard/       indicadores, gráficos, orçamento e contas a pagar
      relatorios/      contas a vencer, por categoria, maiores gastos, comparação
      dados/           backup, restauração, CSV, apagar tudo (+ rotas de download)
    auth/confirm/      destino dos links enviados por e-mail
  components/          componentes compartilhados; charts/ (gráficos SVG); ui/ (shadcn)
  db/                  schema Drizzle (tabelas e RLS), conexão e checagem de tipos schema ↔ domínio
  domain/              regras de negócio puras (sem banco e sem React):
                       datas, recorrências, ocorrências, edição de séries, saldos e orçamento
  lib/                 login (requireUser), clientes Supabase, dinheiro, categorias,
                       grade anual, relatórios, backup e CSV
  server/              consultas ao banco e executor dos planos de edição de séries
  proxy.ts             renova a sessão e redireciona quem não está logado
supabase/
  config.toml          configuração do Supabase local
  migrations/          SQL gerado pelo Drizzle
  templates/           e-mails de confirmação e de recuperação de senha (pt-BR)
```

**Edição de séries:** as funções de `src/domain/series-edit.ts` não gravam nada. Elas devolvem um **plano**, uma lista ordenada de operações, que `src/server/series-ops.ts` executa numa única transação. Assim, toda a regra de negócio é testável sem banco.

---

## 🔒 Segurança

- **Duas camadas de isolamento:** o servidor acessa o banco pelo Drizzle e **sempre filtra pelo usuário logado** (`requireUser()`). Além disso, a **RLS** do Supabase garante que cada usuário só acessa as próprias linhas.
- Toda Server Action valida os dados de entrada (zod) e confere se as categorias e séries pertencem ao usuário.
- O destino após o login (`?next=`) só aceita caminhos internos, o que evita redirecionamento para sites externos.
- Rotas de download (backup e CSV) exigem login.
- O CSV é protegido contra execução de fórmulas no Excel (CSV injection).

---

## ✅ Testes

```bash
npm test
```

São cerca de 140 testes unitários (Vitest), cobrindo:
- datas, incluindo fim de mês, anos bissextos e fuso horário;
- geração de ocorrências em todas as frequências;
- edição e exclusão de séries em cada alcance;
- marcar anteriores como pagas;
- saldos, previsto × realizado e orçamento;
- grade anual, relatórios, backup (validação e restauração) e CSV;
- conversão de valores em reais.

Os testes de edição de séries usam um simulador em memória (`src/domain/testing/apply-ops.ts`) que aplica cada plano com as mesmas restrições do banco: chave única, exclusão em cascata e fim depois do início.
