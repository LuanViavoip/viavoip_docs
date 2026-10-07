# Importador — Import Format — Provisional

Funcionalidade necessária, acessível pela administração autenticada em `/admin/import`. Não há API pública de importação. Todas as actions prepare/apply/cancel/retry verificam requireAdmin no servidor, independentemente da página ou do Profile.

## Fluxo

Upload pasta/ZIP/índice JSON → parsing → validação → preparação do texto → staging vinculado à sessão → preview → confirmação → revalidação sob locks → publicação dos arquivos → transação PostgreSQL → ativação → cleanup seguro.

Preview resume documentos, HTMLs enviados, imagens, exemplos, perfis, inclusões/alterações/exclusões e warnings/errors. Erros bloqueiam; preview obsoleto exige novo envio. Staging expira em uma hora; claim exclusivo protege o trabalho contra cancelamento/expiração concorrentes.

## Contrato provisório

`index-schema.ts` descreve docs-index.json atual; `structure.ts` converte esse adaptador em árvore independente. O contrato oficial aguardará exemplos reais da ViaVOIP/Sol-Maker. Nós podem ter `file` (HTML enviado) ou `contentUrl` (conteúdo já disponível), nunca ambos; título é obrigatório quando não há file. Sem índice, pastas geram seções e HTMLs geram páginas. Perfil desconhecido ou index.html/index.htm ambíguos são erros bloqueantes. Slugs derivados duplicados são renomeados com warning.

Limites: 50 MB upload, 200 MB descompactado, 3000 arquivos, HTML 2 MB, imagem 10 MB, exemplo 200 KB. HTML é decodificado e armazenado em UTF-8. CSS/JS são ignorados; caminhos inseguros (`../`, absolutos) não são persistidos e geram warning no preview ("Arquivo ignorado por caminho inseguro: ..."); caminhos normalizados duplicados são recusados.

## Persistência e recuperação

A aplicação substitui a árvore inteira do sistema em uma transação. Locks PostgreSQL global de referências e por sistema coordenam concorrência. Arquivos são publicados antes do commit para evitar referências ativas sem arquivos. Falha de validação não altera o banco. Commit ambíguo preserva arquivos e exige verificar o estado, sem promessa falsa de rollback.

Falha de cleanup após sucesso informa ativação concluída/limpeza pendente. Retry relê referências ativas sob locks, preservando também dependências locais e referências cruzadas entre sistemas. Claims só são finalizados quando possuem marker de ativação confirmada; trabalho sem prova de commit permanece para investigação. Ver [ARCHITECTURE.md](../../../docs/ARCHITECTURE.md).

HTML importado nunca é entregue cru; Content Service sanitiza antes de renderizar. `/content/...` entrega apenas imagens com nosniff/CSP sandbox. Origens remotas estão desabilitadas.
