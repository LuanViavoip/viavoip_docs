# Desenvolvimento

## Fluxo local

```bash
pnpm db:up        # PostgreSQL via Docker
pnpm dev          # http://localhost:3000
```

Antes de abrir um PR (ou ao terminar uma tarefa):

```bash
pnpm typecheck && pnpm lint && pnpm build
```

### Alterando o schema

1. Edite `prisma/schema.prisma`.
2. `pnpm db:migrate --name descricao-curta` (gera e aplica a migration).
3. `pnpm db:generate` se o client não tiver sido regenerado.
4. Ajuste `prisma/seed.ts` / `src/data/demo/` e rode `pnpm db:seed`.

Enquanto o modelo for provisório, prefira poucas migrations simples. Se o banco local ficar inconsistente,
`pnpm db:reset` recria tudo.

### Adicionando um documento demonstrativo

1. Crie o HTML em `public/demo-docs/` (marcado como DEMONSTRAÇÃO).
2. Adicione o nó em `src/data/demo/sol-maker-demo.ts` (com `contentUrl`, perfis e exemplos).
3. `pnpm db:seed` (o texto pesquisável é extraído automaticamente).

## Convenções

- **Arquivos:** `kebab-case`; componentes React em `PascalCase`.
- **Organização:** regras de domínio e acesso a dados em `src/features/<domínio>`; componentes de
  apresentação em `src/components`; utilitários genéricos em `src/lib`.
- **Dados:** leitura em Server Components; mutações/consultas disparadas pelo cliente via Server Actions
  com validação Zod. Toda escrita administrativa chama `requireAdmin()` no servidor. Não criar rotas de API sem necessidade (e nunca uma API pública de importação).
- **HTML de documentação:** sempre pela camada `features/content`. Nunca usar `dangerouslySetInnerHTML`
  fora de `components/docs/html-content.tsx`, e só com `SafeHtml`.
- **`fetch` de documentação:** apenas no servidor, dentro de `features/content/sources.ts`.
- **Uniões/enums:** `switch` com verificação `never` no `default`.
- **Imports** no topo do arquivo; sem `any` sem justificativa.
- **Textos da interface** em português.

## Next.js 16

Esta versão tem mudanças relevantes (ex.: `params`/`searchParams` assíncronos, `proxy.ts` no lugar de
`middleware.ts`, `error.tsx` recebe `retry`). A documentação correspondente à versão instalada está em
`node_modules/next/dist/docs/`. Os tipos globais `PageProps<"/rota">` e `LayoutProps<"/rota">` são
gerados por `next typegen` (já incluído em `pnpm typecheck`).

## Problemas comuns

| Sintoma | Solução |
| --- | --- |
| Tela "Algo deu errado" ao abrir | `pnpm db:up`, depois `pnpm db:migrate` e `pnpm db:seed` |
| Porta 5432 ocupada | Altere `POSTGRES_PORT` e a porta em `DATABASE_URL` no `.env` |
| Tipos do Prisma ausentes | `pnpm db:generate` |
| Sempre volta para a seleção de perfil | O cookie foi bloqueado/limpo, ou o perfil salvo não existe mais (rode o seed) |

## Testes

Execute `pnpm test` para a suíte permanente e `pnpm test:integration` com TEST_DATABASE_URL para PostgreSQL descartável. Fixtures XSS ficam somente nos testes; nunca em HTML público. Veja README para configurar autenticação administrativa e documentação do fluxo provisório.
