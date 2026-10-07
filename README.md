# ViaVOIP Docs

Sistema web interno para centralizar a documentação da ViaVOIP: sistemas, módulos, bibliotecas, APIs,
componentes, integrações e exemplos de código.

> **Fase 1 (fundação).** O modelo de dados, os perfis e os conteúdos são **provisórios** e
> **demonstrativos**. O formato oficial do índice e a origem real dos HTMLs serão definidos depois que
> recebermos os exemplos reais da ViaVOIP/Sol-Maker. Veja [docs/ROADMAP.md](docs/ROADMAP.md).

## Como funciona (resumo)

- A **estrutura** da documentação (árvore do índice) fica no PostgreSQL.
- Cada documento aponta para o seu **HTML** através de `contentUrl`. Os HTMLs de demonstração ficam em
  `public/demo-docs/`; a documentação **importada** pela interface fica em `storage/` (fora de `public/`).
- A importação é feita em `/admin/import`, com autenticação administrativa: a pessoa envia, do próprio computador, uma **pasta**, um **.zip** ou um **índice JSON provisório** com os HTMLs e imagens; vê uma prévia da árvore e confirma. Detalhes em
  [src/features/importer/README.md](src/features/importer/README.md).
- O HTML é lido **no servidor**, **sanitizado** e então renderizado na área central.
- O texto extraído do HTML sanitizado fica em `Document.searchableContent` e alimenta a pesquisa
  (no futuro, PostgreSQL Full Text Search).
- O usuário escolhe um **perfil** (Desenvolvedor, Suporte, ...) que filtra a árvore e a pesquisa.
  **Perfil não é autenticação nem controle de acesso.**

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Linguagem | TypeScript (strict) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) + lucide-react |
| Banco | PostgreSQL 17 (Docker Compose) |
| ORM | Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Validação | Zod |
| HTML | `sanitize-html` (sanitização e extração de texto) |
| Importação | `fflate` (leitura de .zip) |
| Código | Shiki (realce de sintaxe no servidor) |

## Requisitos

- Node.js 20.19+, 22.12+ ou 24+ (o Prisma 7 declara suporte oficial a essas linhas; o projeto foi
  validado também com Node 26)
- pnpm 10+
- Docker com Docker Compose

## Instalação e primeira execução

```bash
cp .env.example .env     # ajuste portas/credenciais se necessário
pnpm install             # também roda `prisma generate` (postinstall)
pnpm db:up               # sobe o PostgreSQL e aguarda ficar saudável
pnpm db:deploy           # aplica as migrations existentes
pnpm db:seed             # cria perfis, o sistema "Sol-Maker Demo" e os documentos demonstrativos
pnpm dev                 # http://localhost:3000
```

Na primeira visita a aplicação pede o perfil do usuário. A escolha fica salva em cookie e pode ser
alterada pelo header.

## Configuração

Variáveis em `.env` (modelo em `.env.example`):

| Variável | Uso |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credenciais do container PostgreSQL |
| `POSTGRES_PORT` | Porta exposta no host (padrão `5432`) |
| `DATABASE_URL` | Conexão usada pelo Prisma e pela aplicação |
| `ADMIN_PASSWORD_HASH` | Hash scrypt gerado por `pnpm admin:hash` |
| `ADMIN_SESSION_SECRET` | Segredo aleatório de pelo menos 32 bytes, exclusivo do servidor |
| `TEST_DATABASE_URL` | Opcional: PostgreSQL descartável para testes de integração |
| `STORAGE_DIR` | Opcional. Onde a documentação importada é gravada (padrão `./storage`) |

Os valores do `.env.example` são apenas para desenvolvimento local. Não coloque senhas reais no repositório.

## Banco, migrations e seed

- Schema: `prisma/schema.prisma` (provisório). Configuração do Prisma: `prisma.config.ts`.
- O Prisma Client é gerado em `src/generated/prisma` (ignorado pelo git).
- `pnpm db:deploy` aplica as migrations existentes (primeira execução, CI, produção). `pnpm db:migrate` só é
  necessário ao alterar o schema: cria e aplica uma nova migration.
- A FK do pai (`Document_parentId_fkey`), o índice parcial das raízes e o trigger de ciclos são definidos por
  SQL na migration. O nome da FK está fixado no schema com `map:`, então `prisma migrate diff` não acusa diferença.
- `pnpm db:seed` é idempotente: atualiza os perfis e recria o sistema demonstrativo.
- `pnpm db:reset` apaga o banco, reaplica as migrations e roda o seed.

## Principais comandos

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | Build e servidor de produção |
| `pnpm typecheck` | Gera os tipos de rota do Next e roda `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm db:up` / `pnpm db:down` | Sobe / derruba o PostgreSQL |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate` | Cria/aplica migrations (desenvolvimento) |
| `pnpm db:deploy` | Aplica migrations existentes |
| `pnpm db:seed` | Popula os dados demonstrativos |
| `pnpm db:reset` | Recria o banco do zero |
| `pnpm db:studio` | Prisma Studio |

## Rotas

| Rota | Descrição |
| --- | --- |
| `/` | Lista de sistemas |
| `/profile` | Seleção do perfil |
| `/docs/[systemSlug]` | Redireciona para o primeiro documento visível |
| `/docs/[systemSlug]/[...documentPath]` | Documento (caminho = cadeia de slugs da árvore) |
| `/admin/login` | Login administrativo separado do perfil |
| `/admin` | Administração autenticada (importação disponível) |
| `/admin/import` | Importação autenticada (pasta, ZIP ou índice provisório, com prévia) |
| `/content/...` | Imagens da documentação importada (somente imagens) |

Não existe API pública de importação: o envio usa Server Actions autenticadas a partir da própria interface. Toda escrita verifica a sessão no servidor.
`pnpm db:reset` não apaga `storage/`; remova a pasta manualmente se quiser zerar também os arquivos.

## Documentação do projeto

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arquitetura, fluxos, banco e decisões
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): convenções e fluxo de desenvolvimento
- [docs/ROADMAP.md](docs/ROADMAP.md): fases planejadas

## Autenticação administrativa

Consulta e Profile permanecem independentes da administração. Configure no `.env`:

1. Rode `pnpm admin:hash` e digite uma senha de ao menos 12 caracteres. O prompt não exibe a senha. Guarde somente o hash resultante em `ADMIN_PASSWORD_HASH`.
2. Gere um segredo aleatório (`openssl rand -hex 32`) e configure `ADMIN_SESSION_SECRET`.
3. Cole os dois valores manualmente no `.env`. Nenhum script grava segredos nesse arquivo, e o `.env.example` deve continuar apenas com placeholders.
4. Reinicie a aplicação e acesse `/admin/login`. Sem configuração válida, a administração fica bloqueada.

Nunca use NEXT_PUBLIC para esses valores ou envie `.env` ao repositório. Cookie administrativo httpOnly, sameSite strict, secure em produção, expiração de oito horas. Produção exige HTTPS. Profile=admin não autentica. Rotação dos valores invalida sessões; logout remove o cookie, sem revogação individual de tokens copiados.

## Import Format — Provisional

O importador é necessário e permanece na área administrativa. O `docs-index.json` atual é um adaptador provisório, não o contrato oficial da empresa. Exemplo de índice sem upload de HTML:

```json
{"system":{"name":"Demonstração"},"documents":[{"title":"Introdução","slug":"introducao","contentUrl":"/demo-docs/introduction.html","profiles":["developer"]}]}
```

Origens HTTP externas ainda estão desabilitadas. Arquivos do envio com caminho inseguro (`../`, caminho absoluto) nunca são importados e aparecem no preview como warning "Arquivo ignorado por caminho inseguro". O preview apresenta contagens, perfis e alterações; erros bloqueiam confirmação. A confirmação revalida perfis e estado do sistema, ativa a nova árvore em transação e remove apenas versões não referenciadas. Se a ativação funcionou mas a limpeza falhou, a interface informa isso e permite repetir a limpeza.

A migration `20261007180000_document_integrity` rejeita dados antigos com ciclos, pais de outro sistema ou slugs raiz duplicados. Faça backup antes de aplicar migrations em banco com dados relevantes; não use db:reset para atualizar produção.

## Verificação

```bash
pnpm typecheck
pnpm lint
pnpm exec prisma validate
pnpm db:generate
pnpm test
pnpm build
# Opcional: configure TEST_DATABASE_URL para um banco descartável
pnpm test:integration
```

O runner de testes usa `--test-isolation=none` e foi validado com Node 26.10. A compatibilidade desse comando com as linhas mais antigas de Node não foi verificada.

A suíte de integração cria/apaga um schema exclusivo nesse banco e verifica migrations, constraints, rollback e importações A → B → C inválida. Sem TEST_DATABASE_URL, o teste é explicitamente pulado. A suíte local usa storage temporário e não depende do banco da aplicação.
