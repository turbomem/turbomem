import { defineConfig } from "vitepress";

const SITE = "https://turbomem.dev";
const DEFAULT_DESC = "Local-first agent memory for TypeScript";
const OG_IMAGE = `${SITE}/logo.svg`;

function pageUrl(relativePath: string): string {
  const path = relativePath.replace(/index\.md$/, "").replace(/\.md$/, "");
  return path ? `${SITE}/${path}` : SITE;
}

export default defineConfig({
  title: "turbomem",
  description: DEFAULT_DESC,
  base: "/",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: SITE,
  },
  head: [["link", { rel: "icon", href: "/logo.svg", type: "image/svg+xml" }]],
  transformHead({ pageData }) {
    const title =
      pageData.title && pageData.title !== "turbomem"
        ? `${pageData.title} | turbomem`
        : "turbomem";
    const description = pageData.description || DEFAULT_DESC;
    const url = pageUrl(pageData.relativePath);

    return [
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "turbomem" }],
      ["meta", { property: "og:image", content: OG_IMAGE }],
      ["meta", { name: "twitter:card", content: "summary" }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
      ["meta", { name: "twitter:image", content: OG_IMAGE }],
    ];
  },
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
