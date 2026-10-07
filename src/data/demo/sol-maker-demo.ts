import type { DemoProfileSlug } from "./profiles";

/**
 * Estrutura DEMONSTRATIVA usada pelo seed. NÃO é o formato oficial do índice de importação,
 * que ainda será definido a partir dos exemplos reais da ViaVOIP/Sol-Maker.
 *
 * Regra de perfis dos mocks: `profiles` vazio/ausente = visível para todos; um nó só aparece
 * se todos os seus ancestros também estiverem visíveis.
 */
export type DemoExample = {
  title: string;
  language?: string;
  content: string;
};

export type DemoDocument = {
  title: string;
  slug: string;
  type?: string;
  contentUrl?: string;
  profiles?: DemoProfileSlug[];
  examples?: DemoExample[];
  children?: DemoDocument[];
};

export type DemoSystem = {
  name: string;
  slug: string;
  description: string;
  documents: DemoDocument[];
};

const DEMO_NOTICE = "// DEMONSTRAÇÃO: endpoint fictício (api.example.com)";

export const solMakerDemo: DemoSystem = {
  name: "Sol-Maker Demo",
  slug: "sol-maker-demo",
  description: "Sistema DEMONSTRATIVO para validar a interface do ViaVOIP Docs. Não representa o Sol-Maker real.",
  documents: [
    {
      title: "Introdução",
      slug: "introducao",
      type: "page",
      contentUrl: "/demo-docs/introduction.html",
    },
    {
      title: "Arquitetura",
      slug: "arquitetura",
      type: "page",
      contentUrl: "/demo-docs/architecture.html",
      profiles: ["developer", "admin"],
    },
    {
      title: "Visão comercial",
      slug: "visao-comercial",
      type: "page",
      contentUrl: "/demo-docs/commercial/overview.html",
      profiles: ["commercial", "admin"],
    },
    {
      title: "Procedimentos de suporte",
      slug: "procedimentos-de-suporte",
      type: "page",
      contentUrl: "/demo-docs/support/troubleshooting.html",
      profiles: ["support", "admin"],
    },
    {
      title: "APIs",
      slug: "apis",
      type: "module",
      profiles: ["developer", "support", "admin"],
      children: [
        {
          title: "Autenticação",
          slug: "autenticacao",
          type: "api",
          contentUrl: "/demo-docs/api/authentication.html",
          profiles: ["developer", "admin"],
          examples: [
            {
              title: "Obter token",
              language: "javascript",
              content: `${DEMO_NOTICE}
const response = await fetch("https://api.example.com/demo/auth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clientId: "demo", clientSecret: "demo-secret" }),
});

const { access_token } = await response.json();`,
            },
            {
              title: "Obter token",
              language: "bash",
              content: `# DEMONSTRAÇÃO: endpoint fictício
curl -X POST https://api.example.com/demo/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"clientId":"demo","clientSecret":"demo-secret"}'`,
            },
            {
              title: "Resposta",
              language: "json",
              content: `{
  "access_token": "demo-token-123",
  "token_type": "Bearer",
  "expires_in": 3600
}`,
            },
          ],
        },
        {
          title: "Clientes",
          slug: "clientes",
          type: "api",
          contentUrl: "/demo-docs/api/clients.html",
          children: [
            {
              title: "Consultar",
              slug: "consultar",
              type: "endpoint",
              contentUrl: "/demo-docs/api/clients/get.html",
              examples: [
                {
                  title: "Consultar cliente",
                  language: "javascript",
                  content: `${DEMO_NOTICE}
const response = await fetch("https://api.example.com/demo/clients/cli_123", {
  headers: { Authorization: \`Bearer \${token}\` },
});

const client = await response.json();`,
                },
                {
                  title: "Consultar cliente",
                  language: "php",
                  content: `<?php
// DEMONSTRAÇÃO: endpoint fictício (api.example.com)
$ch = curl_init("https://api.example.com/demo/clients/cli_123");
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$token}"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$client = json_decode(curl_exec($ch), true);`,
                },
                {
                  title: "Resposta",
                  language: "json",
                  content: `{
  "id": "cli_123",
  "name": "Cliente Demo",
  "email": "cliente@example.com",
  "active": true
}`,
                },
              ],
            },
            {
              title: "Criar",
              slug: "criar",
              type: "endpoint",
              contentUrl: "/demo-docs/api/clients/create.html",
              profiles: ["developer", "admin"],
              examples: [
                {
                  title: "Criar cliente",
                  language: "javascript",
                  content: `${DEMO_NOTICE}
const response = await fetch("https://api.example.com/demo/clients", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "Cliente Demo", email: "cliente@example.com" }),
});`,
                },
                {
                  title: "Criar cliente",
                  language: "php",
                  content: `<?php
// DEMONSTRAÇÃO: endpoint fictício (api.example.com)
$payload = json_encode(["name" => "Cliente Demo", "email" => "cliente@example.com"]);

$ch = curl_init("https://api.example.com/demo/clients");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer {$token}",
    "Content-Type: application/json",
]);`,
                },
              ],
            },
            {
              title: "Atualizar",
              slug: "atualizar",
              type: "endpoint",
              contentUrl: "/demo-docs/api/clients/update.html",
              profiles: ["developer", "admin"],
              examples: [
                {
                  title: "Atualizar cliente",
                  language: "bash",
                  content: `# DEMONSTRAÇÃO: endpoint fictício
curl -X PATCH https://api.example.com/demo/clients/cli_123 \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"active": false}'`,
                },
              ],
            },
          ],
        },
        {
          title: "Usuários",
          slug: "usuarios",
          type: "api",
          contentUrl: "/demo-docs/api/users.html",
          profiles: ["developer", "admin"],
          examples: [
            {
              title: "Listar usuários",
              language: "javascript",
              content: `${DEMO_NOTICE}
const response = await fetch("https://api.example.com/demo/users?page=1&perPage=20", {
  headers: { Authorization: \`Bearer \${token}\` },
});`,
            },
          ],
        },
      ],
    },
    {
      title: "Bibliotecas",
      slug: "bibliotecas",
      type: "module",
      profiles: ["developer", "admin"],
      children: [
        {
          title: "SIP",
          slug: "sip",
          type: "library",
          contentUrl: "/demo-docs/libraries/sip.html",
          examples: [
            {
              title: "Inicialização",
              language: "javascript",
              content: `// DEMONSTRAÇÃO: "demo-sip" é uma biblioteca fictícia
import { createSipClient } from "demo-sip";

const client = createSipClient({ server: "wss://sip.example.com", user: "1000" });
client.on("registered", () => console.log("Registrado (demo)"));`,
            },
          ],
        },
        {
          title: "WebRTC",
          slug: "webrtc",
          type: "library",
          contentUrl: "/demo-docs/libraries/webrtc.html",
          examples: [
            {
              title: "Capturar áudio",
              language: "javascript",
              content: `const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const [track] = stream.getAudioTracks();
console.log("Microfone:", track.label);`,
            },
          ],
        },
      ],
    },
  ],
};
