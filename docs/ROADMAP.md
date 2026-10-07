# Roadmap

## Fundação implementada — validação operacional pendente no ambiente de destino

Next.js App Router, TypeScript strict, Tailwind/shadcn, PostgreSQL/Prisma, HTML separado por contentUrl, sanitização, perfis de personalização, árvore recursiva, exemplos e pesquisa simples.

Importador administrativo necessário: upload pasta/ZIP/índice JSON, validação, staging, preview, confirmação, aplicação transacional, proteção de concorrência e limpeza segura. Consulta pode ser aberta; escrita exige autenticação administrativa independente de Profile. Sem API pública de importação.

Autenticação administrativa mínima por hash/sessão via environment já implementada. Testes locais permanentes e suíte PostgreSQL opt-in. Executar migrations/seed/build e teste funcional completo no ambiente de destino antes de considerar a entrega operacional encerrada.

## Próxima etapa — exemplos reais ViaVOIP/Sol-Maker

Receber índices, HTMLs, imagens, links e exemplos reais sanitizados; definir perfis, metadados e políticas de visibilidade. **Import Format — Provisional**: docs-index.json atual não é padrão definitivo. Adaptar parser e validação ao contrato confirmado, preservando staging/preview/autorização/aplicação.

Definir origem real de contentUrl. Habilitação HTTP exige allowlist, proteção SSRF, redirects/DNS seguros, timeout e limites. Decidir atualização incremental somente se os exemplos reais exigirem.

## Backlog — evolução posterior, mediante requisitos

Nada abaixo está implementado.

- **Conteúdo lateral adicional:** definir novos tipos de conteúdo lateral depois da análise dos exemplos reais ViaVOIP/Sol-Maker. Hoje o painel renderiza `kind = "code"` (request e response aparecem como blocos de código); `Example.kind` e o `switch` de `examples-panel.tsx` são o ponto de extensão.
- **PostgreSQL Full Text Search** (tsvector/GIN/ranking no banco), reindexação e cache quando necessários; inclui deixar de carregar o `searchableContent` inteiro de cada resultado.
- **SSO/usuários:** substituir a fronteira de autenticação administrativa por usuários/SSO corporativo quando definido; revogação imediata da sessão no logout (hoje stateless); limite de tentativas de login por origem ou na infraestrutura (hoje global por processo). Proteção de leitura para documentos confidenciais exige responsabilidade separada.
- **HTML remoto:** `contentUrl` HTTP(S) continua desabilitado; habilitar exige allowlist, proteção SSRF (IPs privados, metadata, redirects, DNS rebinding), timeout e limite de tamanho.
- **Importador:** limpeza de staging órfão antigo (`.creating`, `.discard-*`, `.working` sem marker); inserção em lote na transação; decidir se colisões de slug devem bloquear em vez de renomear com warning; administração adicional conforme uso real.
- **Interface:** resposta 404 real para documento inexistente (hoje 200 por streaming); altura máxima e barra de rolagem dos blocos de código; validação em 390 px.
- **Testes e plataforma:** testes E2E completos; validação em Node 20/22.

Download, editor, WebView, OAuth/RBAC completo, IA/RAG, bancos vetoriais, serviços externos de pesquisa, Redis e Kafka não fazem parte da implementação atual.
