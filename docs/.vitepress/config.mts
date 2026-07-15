import { defineConfig } from "vitepress";

const SITE = "https://docs.turbomem.dev";
const MARKETING_SITE = "https://turbomem.dev";
const DEFAULT_DESC = "Local-first agent memory for TypeScript";
const OG_IMAGE = `${MARKETING_SITE}/web-app-manifest-full-512x512.png`;

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
  appearance: "dark",
  sitemap: {
    hostname: SITE,
  },
  head: [
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "48x48" }],
    ["link", { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" }],
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }],
    ["link", { rel: "manifest", href: "/site.webmanifest" }],
    ["meta", { name: "theme-color", content: "#ffffff" }],
  ],
  transformHead({ pageData }) {
    const title =
      pageData.title && pageData.title !== "turbomem" ? `${pageData.title} | turbomem` : "turbomem";
    const description = pageData.description || DEFAULT_DESC;
    const url = pageUrl(pageData.relativePath);

    return [
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: url }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "turbomem" }],
      ["meta", { property: "og:image", content: OG_IMAGE }],
      ["meta", { property: "og:image:width", content: "512" }],
      ["meta", { property: "og:image:height", content: "512" }],
      ["meta", { property: "og:image:type", content: "image/png" }],
      ["meta", { property: "og:image:alt", content: "turbomem logo" }],
      ["meta", { name: "twitter:card", content: "summary" }],
      ["meta", { name: "twitter:title", content: title }],
      ["meta", { name: "twitter:description", content: description }],
      ["meta", { name: "twitter:image", content: OG_IMAGE }],
    ];
  },
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "Site", link: MARKETING_SITE },
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "CLI", link: "/cli" },
      { text: "MCP", link: "/mcp" },
      { text: "Adapters", link: "/adapters/mastra", activeMatch: "/adapters/" },
      { text: "API", link: "/api/reference" },
      { text: "Examples", link: "/examples" },
      { text: "Blog", link: "https://blog.turbomem.dev" },
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
          { text: "Storage", link: "/guide/storage" },
          { text: "Edge", link: "/guide/edge" },
          { text: "Browser", link: "/guide/browser" },
          { text: "Providers", link: "/guide/providers" },
          { text: "Architecture", link: "/guide/architecture" },
        ],
      },
      {
        text: "CLI",
        items: [{ text: "Overview", link: "/cli" }],
      },
      {
        text: "MCP",
        items: [{ text: "Claude Desktop", link: "/mcp" }],
      },
      {
        text: "Adapters",
        items: [
          { text: "Mastra", link: "/adapters/mastra" },
          { text: "Vercel AI SDK", link: "/adapters/vercel-ai" },
          { text: "OKF (Experimental)", link: "/adapters/okf" },
        ],
      },
      {
        text: "API",
        items: [{ text: "Reference", link: "/api/reference" }],
      },
      {
        text: "More",
        items: [
          { text: "Examples", link: "/examples" },
          { text: "Roadmap", link: "/roadmap" },
          { text: "Contact", link: "/contact" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/turbomem/turbomem" }],
    footer: {
      message:
        'Questions or feedback? <a href="/contact">Contact us</a> or email <a href="mailto:arneesh@turbomem.dev">arneesh@turbomem.dev</a>.',
      copyright: "Apache-2.0 Licensed | Copyright © turbomem",
    },
    search: {
      provider: "local",
    },
  },
});
