# 💰 Controle Financeiro Anual (milafin)

Controle de finanças pessoais. A **versão definitiva** está sendo construída em Next.js + Supabase. As decisões de requisitos e de stack estão em [`REQUISITOS.md`](REQUISITOS.md).

A segunda parte deste documento descreve o **protótipo** (HTML único), que é a referência funcional da nova versão.

---

## 🛠 Versão definitiva: desenvolvimento local

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Postgres + Auth) · Drizzle ORM + Server Actions · Tailwind CSS 4 + shadcn/ui · Vitest. O deploy previsto é na Vercel e no Supabase na nuvem, mas por enquanto **tudo roda localmente** (F6).

### Pré-requisitos

- **Node.js** 22 ou superior (testado com o 26)
- **Docker Desktop** em execução (o Supabase local roda em containers)

### Primeira execução

```bash
npm install
npm run db:start      # sobe o Supabase local e aplica as migrações (1ª vez: baixa as imagens)
npm run env:local     # gera o .env.local com URL, chave e conexão do banco local
npm run dev           # http://localhost:3000
```

Crie uma conta em `/cadastro`. O e-mail de confirmação **não é enviado de verdade**: ele cai no **Mailpit**.

| Serviço local | Endereço |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio (tabelas, usuários) | http://127.0.0.1:54323 |
| Mailpit (e-mails de cadastro e senha) | http://127.0.0.1:54324 |
| API do Supabase | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` / `npm run test:watch` | Testes unitários (Vitest) |
| `npm run typecheck` / `npm run lint` | Checagem de tipos e lint |
| `npm run db:start` / `db:stop` / `db:status` | Liga, desliga e mostra o status do Supabase local |
| `npm run db:generate` | Gera uma migração SQL a partir de `src/db/schema.ts` |
| `npm run db:reset` | Recria o banco local aplicando todas as migrações (**apaga os dados locais**) |
| `npm run env:local` | (Re)gera o `.env.local` a partir do Supabase local |

### Alterando o banco

1. Edite `src/db/schema.ts`.
2. Rode `npm run db:generate`. A migração é criada em `supabase/migrations/`.
3. Rode `npm run db:reset` para aplicá-la no banco local.

O schema é a fonte da verdade. Não edite as migrações já aplicadas.

### Estrutura

```
src/
  app/
    (auth)/          entrar, cadastro, esqueci-senha, redefinir-senha + Server Actions de auth
    (app)/           área logada: lancamentos, dashboard, relatorios, categorias, dados
    auth/confirm/    destino dos links enviados por e-mail (token_hash → sessão)
  db/                schema Drizzle (tabelas, RLS) e conexão
  lib/               auth (requireUser), clientes Supabase, dinheiro em centavos
  proxy.ts           renova a sessão e redireciona quem não está logado
supabase/
  config.toml        configuração do Supabase local (auth, portas)
  migrations/        SQL gerado pelo Drizzle
  templates/         e-mails de confirmação e recuperação (pt-BR)
```

**Segurança:** o servidor acessa o banco via Drizzle e **sempre filtra por `user_id`** do `requireUser()`. A RLS do Supabase (cada usuário só acessa as próprias linhas) é a segunda camada.

---

# 🧪 Protótipo (referência)

Protótipo de controle financeiro pessoal: um **único arquivo HTML** que roda direto no navegador, sem instalação e sem servidor.

Você lança receitas e despesas numa grade anual, com os meses nas colunas. O sistema calcula subtotais, o saldo do mês e o saldo acumulado, e mostra um dashboard do ano.

## Sumário

- [Arquivos](#-arquivos)
- [Como usar](#-como-usar)
- [Funcionalidades](#-funcionalidades)
- [Conceitos do domínio](#-conceitos-do-domínio)
- [Modelo de dados](#-modelo-de-dados)
- [Persistência, backup e migração](#-persistência-backup-e-migração)
- [Formatos de arquivo](#-formatos-de-arquivo)
- [Arquitetura do código](#-arquitetura-do-código)

---

## 📁 Arquivos

| Arquivo | Descrição |
|---|---|
| `Prototype/controle_financeiro_FINAL.html` | **Versão final do protótipo.** Todo o app (HTML, CSS e JavaScript) num só arquivo. |
| `Prototype/controle_financeiro_V1.html` | Primeiro protótipo, mantido só como referência. |
| `README.md` | Este documento: desenvolvimento da nova versão e referência do protótipo. |
| `REQUISITOS.md` | Decisões de requisitos e de stack da versão definitiva. |

---

## 🚀 Como usar

1. Abra `Prototype/controle_financeiro_FINAL.html` num navegador moderno (Chrome, Edge, Firefox ou Safari atuais).
2. Pronto. Não há instalação, build, dependências nem conexão com a internet.

Os dados ficam salvos **no próprio navegador** (`localStorage`). Por isso:

- Use sempre **o mesmo navegador, no mesmo computador**. Abrir o arquivo em outro navegador mostra uma tela vazia.
- Faça **backups periódicos** pela aba *Dados e backup*. O app avisa quando o último backup tem 7 dias ou mais.
- Se você usava o V1 nesse mesmo navegador, os dados são **migrados automaticamente** na primeira abertura da versão final.

---

## ✨ Funcionalidades

O app tem três telas, alternadas por abas. A tela atual fica no endereço da página (`#lancamentos`, `#dashboard`, `#dados`), então recarregar a página mantém a aba e o botão Voltar do navegador funciona.

### 📋 Lançamentos (tela principal)

A grade anual mostra os meses nas colunas e uma coluna de total do ano. Ela é dividida em três categorias:

| Categoria | Efeito no saldo | Pode ser recorrente? |
|---|---|---|
| 🟢 **Receitas** | soma | sim |
| 🟠 **Despesas recorrentes** | subtrai | sim (marcado por padrão) |
| 🔴 **Despesas esporádicas** | subtrai | não |

Dentro de cada categoria, cada **item** (ex.: "Aluguel", "Salário") ocupa uma linha. Cada categoria termina com um **subtotal**. No fim da grade ficam:

- **Saldo do mês**: receitas − despesas.
- **Saldo acumulado no ano**: soma dos saldos de janeiro até aquele mês.

**Interações:**

| Ação | Como fazer |
|---|---|
| Novo lançamento | Botão **+ Novo lançamento**, ou clique em **+ item** no cabeçalho da categoria (já vem com o mês preenchido) |
| Adicionar num item existente | Clique num **–** da linha do item (já vem com tipo, item e mês preenchidos) |
| Editar ou excluir | Clique no **valor** da célula |
| Vários lançamentos na mesma célula | A célula mostra um número pequeno (ex.: ²) e o clique abre a lista para escolher qual editar |
| Renomear ou mesclar um item | Botão **✎** ao lado do nome do item |
| Trocar o ano | Botões **◀ ▶**; clicar no ano volta para o ano atual |

Um **canto azul** na célula indica que o valor vem de uma série recorrente.

**Atalhos:** `Esc` fecha o modal, `Enter` salva, e clicar fora do modal também fecha.

### 📊 Dashboard

Mostra o resumo do ano selecionado:

- **Cards:** receitas no ano, despesas no ano e saldo do ano.
- **Gráfico:** barras de despesas recorrentes e esporádicas por mês, com uma linha de receita por cima. Passar o mouse mostra os valores.

O layout se adapta à largura da tela:
- **Tela larga:** cards em coluna à esquerda e o gráfico à direita.
- **Tela média:** cards em linha acima do gráfico.
- **Celular:** um card por linha.

### 💾 Dados e backup

- **Situação dos dados:** data do último backup, se o armazenamento é persistente, e quantos lançamentos e séries existem.
- **Backup completo (.json):** todos os anos, inclusive as recorrências.
- **Restaurar backup:** aceita backups desta versão e do V1. Você escolhe entre **Mesclar** (não duplica itens com o mesmo ID) e **Substituir tudo**.
- **Exportar para Excel (CSV):** exporta um ano escolhido num seletor que lista os anos com dados.
- **Importar CSV:** adiciona lançamentos, ignora os duplicados e mostra um resumo para confirmar.
- **Apagar todos os dados:** oferece fazer um backup antes.

---

## 🧠 Conceitos do domínio

### Lançamento avulso
Um valor num mês específico (ex.: "TV — Abr/2026 — R$ 2.500,00"). Pode ser movido para outro mês na edição.

### Série recorrente
Uma **regra** de repetição mensal, e não cópias do lançamento em cada mês. Uma série tem:
- mês inicial;
- mês final, **ou sem fim** (aparece em todos os anos futuros);
- lista de **meses excluídos** (exceções).

Ao **editar** ou **excluir** um mês de uma série, você escolhe o alcance:

| Opção | Ao editar | Ao excluir |
|---|---|---|
| **Só este mês** | O mês sai da série e vira um lançamento avulso com os novos dados | O mês é marcado como excluído da série |
| **Deste mês em diante** | A série é **dividida**: a antiga termina no mês anterior e uma nova começa neste mês com os novos dados. **O passado não muda.** É o caso típico de reajuste de aluguel. | A série passa a terminar no mês anterior |
| **Toda a série** | Altera todos os meses, inclusive os passados | Apaga a série inteira |

### Item (descrição)
É o nome que agrupa os lançamentos numa linha da grade. Para evitar linhas duplicadas por erro de digitação:
- o campo sugere os itens já existentes da categoria;
- variações só de maiúsculas/minúsculas ou de espaços são unificadas ("luz" vira "Luz");
- o botão **✎** renomeia o item em todos os anos e, se o novo nome já existir, **mescla** as duas linhas.

### Valores monetários
São sempre guardados em **centavos inteiros**, o que evita erros de arredondamento como `0,1 + 0,2 ≠ 0,3`.

O campo de valor aceita estes formatos:
- `1.234,56`
- `1234,56`
- `1234.56`
- `R$ 50`

Valores zero ou negativos são recusados.

---

## 🗄 Modelo de dados

Os dados são guardados em `localStorage`, na chave `controle_financeiro_v2`:

```jsonc
{
  "version": 2,
  "entries": [                       // lançamentos avulsos
    { "id": "uuid", "type": "esporadica", "desc": "TV", "cents": 250000, "y": 2026, "m": 3 }
  ],
  "series": [                        // recorrências
    { "id": "uuid", "type": "recorrente", "desc": "Aluguel", "cents": 280000,
      "start": 24312,                // índice de mês absoluto = ano*12 + mês (0..11)
      "end": null,                   // null = sem fim
      "skip": [24314] }              // meses excluídos (índice absoluto)
  ],
  "archived": { "entries": [], "series": [] },   // registros de tipos descontinuados (só preservados)
  "meta": { "lastBackup": "2026-11-08T19:37:55.000Z" }
}
```

| Campo | Regras |
|---|---|
| `type` | `receita`, `recorrente` ou `esporadica` (séries não aceitam `esporadica`) |
| `cents` | inteiro > 0 |
| `m` | 0 = janeiro … 11 = dezembro |
| `start` / `end` | índice absoluto de mês; `end ≥ start`, ou `null` |
| `id` | único entre todos os registros; é ele que evita duplicar ao mesclar backups |

**Validação:** todo dado lido (do navegador, de backup ou de CSV) passa por `normalizeDB()`. Ela descarta registros inválidos, corrige IDs repetidos e padroniza as descrições.

**Registros arquivados:** registros de tipos que não existem mais no app são guardados em `archived`. Eles não aparecem nas telas nem entram nos cálculos, mas são preservados no backup.

---

## 🔒 Persistência, backup e migração

| Mecanismo | Comportamento |
|---|---|
| **Salvamento** | Automático a cada alteração. Se falhar (armazenamento cheio ou bloqueado), o app avisa para fazer backup. |
| **Armazenamento persistente** | O app pede ao navegador (`navigator.storage.persist()`) que não apague os dados quando faltar espaço. O resultado aparece na aba Dados. |
| **Lembrete de backup** | Um aviso no topo aparece se nunca houve backup ou se o último tem 7 dias ou mais. |
| **Dados corrompidos** | Se os dados salvos estiverem ilegíveis, eles são **copiados** para `controle_financeiro_v2_corrompido_<timestamp>` antes de qualquer coisa, e nunca são sobrescritos. |
| **Várias abas abertas** | Uma alteração feita numa aba do navegador atualiza as outras automaticamente. |
| **Migração do V1** | Se não existir dado da versão final mas existir a chave `controle_financeiro_v1`, os dados são convertidos (ver abaixo). Os dados originais do V1 **são preservados**. |

### Como o V1 é convertido

- Valores em reais viram centavos.
- Grupos recorrentes do V1 (lançamentos copiados mês a mês) viram **séries**, com os meses faltantes marcados como excluídos.
- Grupos inconsistentes (valores, nomes ou tipos diferentes entre os meses) viram lançamentos avulsos, para não perder nada.

---

## 📄 Formatos de arquivo

### Backup `.json` (formato v2)

```json
{
  "app": "controle_financeiro",
  "version": 2,
  "exportedAt": "2026-11-08T19:37:55.000Z",
  "count": { "entries": 2, "series": 3 },
  "data": { "entries": [...], "series": [...], "archived": {...} }
}
```

A restauração também aceita os formatos do V1: uma lista pura `[...]` ou `{ "data": [...] }`.

### CSV (para Excel)

- Separador: `;`
- Codificação: UTF-8 com BOM
- Decimal com vírgula, para abrir corretamente no Excel em português
- Um arquivo por ano: `financas_<ano>.csv`

```
"Ano";"Mes";"Tipo";"Descricao";"Valor";"Origem"
"2026";"Jan";"Receitas";"Salário";"8500,00";"Recorrente"
```

**Importação:**
- Aceita CSVs exportados pelo V1 (5 colunas, decimal com ponto) e pela versão final.
- O mês pode vir como `Jan`, `janeiro`, `1` ou `01`.
- Linhas iguais a lançamentos já existentes (mesmo ano, mês, tipo, item e valor) são ignoradas.
- Tudo entra como **lançamento avulso**, porque o CSV não guarda recorrências. Para transportar recorrências, use o backup `.json`.

---

## 🏗 Arquitetura do código

`controle_financeiro_FINAL.html` é autocontido: não usa bibliotecas externas e os gráficos são desenhados em SVG direto no código. Ele se organiza em blocos:

| Bloco (no `<script>`) | Responsabilidade |
|---|---|
| Constantes e utilitários | `TIPOS`, `MESES`, funções de mês absoluto (`ym`), `esc()` (escape de HTML), `parseBRL()`, `fmt()` |
| Persistência | `emptyDB`, `normalizeDB`, `migrateV1`, `loadDB`, `save`, `commit` |
| Consultas | `occurrences(ano)` junta avulsos e meses das séries; `allDescs`, `canonicalDesc`, `pruneSeries` |
| Grade | `render()`, `section()`, `tableHead()` |
| Dashboard | `renderDashboard()`, `groupedChart()`, `yAxis()` |
| Modais | Pilha de modais, `askChoice` / `confirmBox` (diálogos com botões explícitos), `toast` |
| Ações | `openAdd`/`saveAdd`, `openEdit`/`saveEdit`/`deleteEdit`, `openCell`, `openRename`/`saveRename` |
| Arquivos | `exportCSV`, `parseCSV` e importação de CSV, `backupJSON`, restauração, `wipe` |
| Telas | `showView()`, controlada pelo `#hash` da URL |

### Características técnicas

- **Segurança:** todo texto vindo do usuário é escapado antes de entrar no HTML. Os cliques usam `data-*` e um único listener (delegação de eventos), sem `onclick` montado com dados do usuário.
- **Recorrências calculadas:** os meses de uma série são calculados na hora de exibir, a partir da regra, e não ficam gravados mês a mês.
- **Precisão:** dinheiro é sempre inteiro em centavos e só é convertido para reais na exibição.
- **Escolha de mês:** usa `select` de mês + campo de ano, em vez de `<input type="month">`, para funcionar igual em todos os navegadores.
- **Responsivo:** a grade rola na horizontal com a coluna de itens fixa, e o dashboard se reorganiza em telas estreitas.
