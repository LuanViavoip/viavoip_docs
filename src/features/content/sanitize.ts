import sanitizeHtml from "sanitize-html";

import { markAsSafeHtml, type SafeHtml } from "@/lib/html/safe-html";

import { contentUrlKey, isExternalUrl, resolveReference } from "./urls";

export type SanitizeOptions = {
  /** contentUrl do documento; base para resolver links e imagens relativos. */
  baseUrl: string;
  /**
   * Converte a URL (já resolvida) de outro documento HTML na rota interna da aplicação.
   * Retorna `undefined` quando a URL não corresponde a um documento conhecido.
   */
  resolveDocumentHref?: (contentUrlKey: string) => string | undefined;
};

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "a", "img", "figure", "figcaption",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td",
  "pre", "code", "kbd", "samp", "blockquote",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "br", "hr", "div", "span", "section", "article", "aside", "details", "summary",
];

/**
 * Configuração base. `script`, `style`, `iframe`, `object`, `embed`, `form`, atributos `on*`,
 * `style` inline e esquemas como `javascript:` ficam de fora por não estarem na allowlist.
 */
const BASE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["id", "class", "title", "lang", "dir"],
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope", "align"],
    td: ["colspan", "rowspan", "align"],
    col: ["span"],
    colgroup: ["span"],
    ol: ["start", "type", "reversed"],
    details: ["open"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: [],
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "template", "title"],
};

/** Único ponto do projeto que transforma HTML não confiável em `SafeHtml`. */
export function sanitizeDocumentHtml(html: string, options: SanitizeOptions): SafeHtml {
  const { baseUrl, resolveDocumentHref } = options;

  const clean = sanitizeHtml(html, {
    ...BASE_CONFIG,
    transformTags: {
      a: (tagName, attribs) => {
        const attributes: sanitizeHtml.Attributes = { ...attribs };
        delete attributes.target;
        delete attributes.rel;

        if (attribs.href) {
          const resolved = resolveReference(attribs.href, baseUrl);
          const hashIndex = resolved.indexOf("#");
          const hash = hashIndex === -1 ? "" : resolved.slice(hashIndex);
          const internalHref = resolveDocumentHref?.(contentUrlKey(resolved));

          if (internalHref) {
            attributes.href = `${internalHref}${hash}`;
          } else {
            attributes.href = resolved;
            if (isExternalUrl(resolved)) {
              attributes.target = "_blank";
              attributes.rel = "noopener noreferrer";
            }
          }
        }
        return { tagName, attribs: attributes };
      },
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          ...(attribs.src ? { src: resolveReference(attribs.src, baseUrl) } : {}),
          loading: "lazy",
        },
      }),
    },
  });

  return markAsSafeHtml(clean);
}

/** Texto puro do HTML (sem tags, scripts ou estilos), com espaços normalizados. */
export function extractSearchableText(html: string): string {
  // O espaço antes de cada tag evita que blocos adjacentes ("<h1>A</h1><p>B</p>") virem "AB".
  const text = sanitizeHtml(html.replace(/</g, " <"), {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: BASE_CONFIG.nonTextTags,
  });

  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITY_MAP[entity] ?? entity);
}
