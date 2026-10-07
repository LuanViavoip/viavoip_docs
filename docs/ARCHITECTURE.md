# Arquitetura — ViaVOIP Docs

A consulta pode ser aberta. A administração e as escritas são protegidas independentemente dos perfis de documentação. O índice atual é **Import Format — Provisional**: será adaptado após os exemplos reais da ViaVOIP/Sol-Maker.

## Consulta e HTML

```text
Visitante → Profile (cookie) → System → árvore Document
→ contentUrl → Content Service no servidor → sanitize → SafeHtml → render
```

Next.js App Router usa Server Components para dados, HTML e realce Shiki. Client Components cuidam de interação, árvore, pesquisa e cópia. `features/content/sources.ts` centraliza a leitura; `sanitize.ts` aplica allowlist e resolve links/imagens relativos. `getDocumentContent()` retorna `ok`, `empty` ou erro tipado. URLs malformadas retornam `invalid-url`; conteúdo vazio ou eliminado pela sanitização retorna empty state.

HTML local vem de `public/demo-docs/` ou de `STORAGE_DIR/systems/`, separado do PostgreSQL. HTTP(S) remoto é reconhecido, mas sua recuperação está desabilitada. Habilitar essa origem exige allowlist, proteção SSRF inclusive DNS/redirects, timeout e limites. O browser não baixa HTML externo diretamente.

`script`, handlers `on*`, `javascript:`, SVG, iframe, object e embed são removidos pela sanitização. Tabelas, imagens, títulos, listas, código e formatação normal são preservados. A renderização exige `SafeHtml`; essa marca é garantia de tipos, e a proteção em runtime vem do sanitizador. O código realçado também produz SafeHtml a partir de texto escapado. Fixtures XSS vivem apenas nos testes; arquivos públicos de demonstração são seguros, pois podem ser acessados diretamente sem passar pelo sanitizador.

A rota `/content/[...path]` entrega apenas imagens importadas, com `nosniff` e CSP `sandbox`. HTML importado não é servido cru. Caminhos normalizados e confinamento ao storage evitam traversal; storage deve ser controlado pela aplicação, sem symlinks criados por terceiros.

## Administração

```text
/admin/login → senha verificada no servidor → sessão assinada
→ /admin → importação → requireAdmin() em cada action de escrita
```

`features/admin/password.ts` usa scrypt com salt aleatório, N=131072, r=8, p=1 e comparação timing-safe. `ADMIN_PASSWORD_HASH` contém apenas o hash; `ADMIN_SESSION_SECRET` assina a sessão. Não há segredo em Client Components ou NEXT_PUBLIC. Sem configuração válida, o acesso falha fechado.

Cookie administrativo: `httpOnly`, `sameSite=strict`, `secure` em produção, path `/admin`, duração de oito horas. A assinatura depende dos dois valores de environment; sua rotação invalida sessões existentes. Login tem limite de cinco tentativas por minuto por processo e uma derivação concorrente. Em múltiplas instâncias, limites globais deverão ser aplicados na infraestrutura. HTTPS é necessário em produção.

`requireAdmin()` é a fronteira substituível por SSO/usuários futuramente. Páginas protegidas chamam `requireAdminPage()` antes de consultar dados; prepare/apply/cancel/retry de importação chamam requireAdmin antes de operar. Server Actions continuam endpoints HTTP internos do Next e validam autorização independentemente da página; não existe API de importação pública ou sem autenticação.

Sessões são stateless: logout remove o cookie do navegador, mas uma cópia de token continua válida até expirar ou rotacionar os segredos. Não há usuários/RBAC nem revogação individual nesta fase.

## Importador administrativo

```text
Upload (pasta / ZIP / índice JSON provisório)
→ parsing → validação completa → staging da sessão → preview
→ confirmar → autorização → claim exclusivo → locks → revalidação
→ publicar arquivos → transação de documentos → commit/ativação
→ nova leitura de referências ativas → limpeza segura
```

Responsabilidades isoladas: `upload.ts` (arquivos/limites), `index-schema.ts` e `structure.ts` (contrato provisório), `prepare.ts` (hierarquia/perfis/HTML/texto), `preview.ts` (contagens/diff simples), `storage.ts` (filesystem), `workflow.ts` (coordenação), `repository.ts` (transações PostgreSQL), `actions.ts` (autorização/entrada), `import-wizard.tsx` (interface).

O JSON pode referenciar `file` enviado ou `contentUrl` existente, nunca ambos. Sem índice, a estrutura de pastas gera a árvore. Perfil inexistente e ambiguidade index.html/index.htm bloqueiam. Slugs derivados repetidos são renomeados com aviso explícito. O preview informa sistema, documentos, HTMLs enviados, imagens, exemplos, perfis, inclusões/alterações/exclusões, warnings/errors. Erros impedem confirmação. Quantidade de HTMLs enviados pode ser zero quando o índice referencia conteúdo já disponível.

Staging nasce como `.creating` e só se torna visível após estar completo; expira em uma hora e pertence à sessão que o criou. Rename para `.working` é claim exclusivo; cancelamento e expiração não removem trabalho em andamento. Um fingerprint do estado do sistema vincula o preview à confirmação: preview obsoleto exige reenvio.

Aplicação usa advisory locks transacionais: coordenação global das referências e lock por slug de System, sempre na mesma ordem. Essa escolha conservadora serializa também sistemas diferentes durante aplicação/cleanup, sem Redis ou coordenação distribuída adicional. Uma transação substitui os documentos e seus vínculos/exemplos. Conteúdos são preparados antes de deletar registros.

Arquivos são promovidos **antes do commit**, para que nenhuma referência nova fique visível antes de seu arquivo existir. PostgreSQL e filesystem não têm uma transação compartilhada: falha anterior ao commit preserva o estado anterior; erro de conexão no commit pode ter resultado ambíguo. Nesse caso arquivos promovidos são preservados e a interface pede verificar o estado, sem afirmar que nada mudou.

Após commit confirmado, uma falha na limpeza resulta em **importação ativada, limpeza pendente**, com botão para repetir a limpeza. Sob locks, referências de todos os documentos e `metadata.managedReferences` (links/imagens locais extraídos do HTML) preservam versões ainda usadas, inclusive por outro sistema. Apenas diretórios comprovadamente não referenciados são apagados. Marker `activated.json` permite finalizar claims já confirmados; claims sem prova de ativação nunca são removidos automaticamente. Uma queda entre commit e gravação do marker pode deixar staging para investigação manual.

## PostgreSQL e hierarquia

```text
System 1—* Document (parentId recursivo)
Document *—* Profile via DocumentProfile
Document 1—* Example
```

Document guarda `contentUrl`, metadados, posição, timestamps e `searchableContent`; não exige HTML no banco. Example admite kind, linguagem, conteúdo e posição. Slugs de System/Profile são únicos. Unicidade de irmãos é composta; raízes têm índice parcial `(systemId, slug) WHERE parentId IS NULL`. FK composta garante que pai e filho pertençam ao mesmo System. CHECK e trigger rejeitam self-parent e ciclos. Validação em código rejeita também órfãos, ciclos e duplicações antes da persistência/construção da árvore.

A migration de integridade contém preflight: dados antigos inválidos bloqueiam sua aplicação, sem reparo destrutivo automático. Índices/trigger personalizados são definidos pelo SQL da migration e devem ser preservados em futuras migrations. Cascade apaga descendentes e exemplos quando um documento/sistema é excluído; importação substitui a árvore completa com confirmação e transação.

O seed prepara e valida todos os HTMLs e perfis antes das escritas; atualiza perfis e substitui documentos demonstrativos em uma transação, usando os mesmos locks do importador.

## Perfis

Cookie `viavoip-docs-profile` personaliza consulta. Sem perfil, a consulta pede escolha; seleção persiste no servidor e pode ser alterada no header. Não há autorização de leitura baseada nesse cookie. Mesmo Profile=admin não concede administração.

Documento sem perfis é global; com um ou vários perfis só aparece para perfis associados. Pai invisível oculta a subárvore. Validação da estrutura completa ocorre antes da filtragem, evitando tratar filhos filtrados como órfãos. URL direta também respeita a personalização, mas qualquer visitante pode trocar seu perfil: dados confidenciais exigirão controle de leitura real.

## Pesquisa

```text
HTML → sanitize → extract text → searchableContent → PostgreSQL
→ correspondências em título/conteúdo/exemplos → ranking → limit
```

Busca atual usa contains/insensitive, não FTS; `%`, `_` e `\` da consulta são escapados e tratados como texto literal. Não baixa HTML durante a pesquisa. Prioriza título, conteúdo e exemplo; desempata pela ordem da árvore e limita só após ordenar. Frontend invalida requisições antigas imediatamente ao digitar/fechar/navegar de sistema. FTS futuro pode substituir o motor isolado com tsvector/GIN, sem Elasticsearch ou IA. A ausência de prelimit pode aumentar memória em sistemas grandes; FTS resolverá o ranking no banco.

## UI e limites atuais

Header com sistema, pesquisa e perfil; árvore recursiva à esquerda; HTML no centro; exemplos/código à direita. Drawer em telas menores, exemplos abaixo do conteúdo antes de xl, botão copiar com fallback, loading/errors/empty states. Conteúdo HTML remoto e formato oficial, exemplos reais, perfis definitivos e renderizadores adicionais dependem dos materiais da ViaVOIP. Sem OAuth, editor, WebView, download ou FTS completo nesta etapa.
