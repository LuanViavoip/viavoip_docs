/** Aceita apenas caminhos internos ("/docs/x"), evitando open redirect ("//host", "https://..."). */
export function safeInternalPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
