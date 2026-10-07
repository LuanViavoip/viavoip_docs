declare const safeHtmlBrand: unique symbol;

/**
 * HTML que já passou por sanitização (ou foi gerado por código confiável, como o highlighter).
 * É o único tipo aceito pelo componente que usa `dangerouslySetInnerHTML`.
 */
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

/** Use apenas em módulos que produzem HTML seguro por construção (sanitizer, highlighter). */
export function markAsSafeHtml(html: string): SafeHtml {
  return html as SafeHtml;
}
