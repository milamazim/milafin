/** Violação de regra de negócio (mensagem pronta para mostrar ao usuário). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
