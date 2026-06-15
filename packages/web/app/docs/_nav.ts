export interface DocLink {
  title: string;
  slug: string; // "" = /docs index
  href?: string; // external override
}
export interface DocGroup {
  group: string;
  items: DocLink[];
}

export const DOC_NAV: DocGroup[] = [
  {
    group: "Getting started",
    items: [
      { title: "Overview", slug: "" },
      { title: "Quickstart", slug: "quickstart" },
      { title: "Architecture", slug: "architecture" },
    ],
  },
  {
    group: "Use it",
    items: [
      { title: "For agents", slug: "agents" },
      { title: "CLI", slug: "cli" },
      { title: "Safety Oracle API", slug: "safety-oracle" },
      { title: "MCP Server", slug: "mcp" },
      { title: "Telegram", slug: "telegram" },
    ],
  },
  {
    group: "How it works",
    items: [
      { title: "Detectors & Corpus", slug: "detectors" },
      { title: "Contracts & ERC-8004", slug: "contracts" },
      { title: "Benchmarks", slug: "benchmarks" },
    ],
  },
  {
    group: "Project",
    items: [
      { title: "Business model", slug: "business" },
      { title: "Security", slug: "security", href: "https://github.com/winsznx/tryanneal/blob/main/SECURITY.md" },
    ],
  },
];
