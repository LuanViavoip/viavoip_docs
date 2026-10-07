/** Perfis FICTÍCIOS, usados apenas para demonstrar a filtragem por perfil. */
export const demoProfiles = [
  { slug: "developer", name: "Desenvolvedor" },
  { slug: "support", name: "Suporte" },
  { slug: "commercial", name: "Comercial" },
  { slug: "admin", name: "Administrador" },
] as const;

export type DemoProfileSlug = (typeof demoProfiles)[number]["slug"];
