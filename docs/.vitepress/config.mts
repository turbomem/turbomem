import { defineConfig } from "vitepress";

export default defineConfig({
  title: "turbomem",
  description: "Local-first agent memory for TypeScript",
  base: "/",
  cleanUrls: true,
  head: [["link", { rel: "icon", href: "/logo.svg", type: "image/svg+xml" }]],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "CLI", link: "/cli" },
      { text: "Adapters", link: "/adapters/mastra", activeMatch: "/adapters/" },
      { text: "API", link: "/api/reference" },
      { text: "Examples", link: "/examples" },
      {
        text: "npm",
        link: "https://www.npmjs.com/package/turbomem",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting started", link: "/guide/getting-started" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "Architecture", link: "/guide/architecture" },
        ],
      },
      {
        text: "CLI",
        items: [{ text: "Overview", link: "/cli" }],
      },
      {
        text: "Adapters",
        items: [
          { text: "Mastra", link: "/adapters/mastra" },
          { text: "Vercel AI SDK", link: "/adapters/vercel-ai" },
        ],
      },
      {
        text: "API",
        items: [{ text: "Reference", link: "/api/reference" }],
      },
      {
        text: "More",
        items: [{ text: "Examples", link: "/examples" }],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/turbomem/turbomem" },
    ],
    search: {
      provider: "local",
    },
  },
});
