/**
 * Regras de negócio puras (sem banco, sem React). Testadas com Vitest.
 *
 * - dates: datas ISO `YYYY-MM-DD` sem fuso, com ajuste de fim de mês
 * - recurrence: datas geradas por uma série (frequência, vencimento, fim, exclusões)
 * - occurrences: junta avulsos + séries + ocorrências editadas num período
 * - series-edit: plano de operações para editar/excluir uma ocorrência
 * - summary: saldos (previsto × realizado), totais por categoria, orçamento
 */
export * from "./dates";
export * from "./errors";
export * from "./occurrences";
export * from "./recurrence";
export * from "./series-edit";
export * from "./summary";
