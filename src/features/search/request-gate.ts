/** Versão de entrada, não de disparo: respostas antigas são inválidas já durante o debounce. */
export function createRequestGate() {
  let version = 0;
  return { invalidate: () => ++version, isCurrent: (request: number) => request === version };
}
