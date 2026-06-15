import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Providers from "./providers";
import "../src/styles/theme.css";

const OG_TITLE = "TryAnneal — the trust layer for autonomous software";
const OG_DESC =
  "is_this_safe() — the question any agent asks before it trusts a contract. Multi-LLM audit + on-chain attestation on Mantle. ERC-8004 agent #131.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tryanneal.xyz"),
  title: {
    default: OG_TITLE,
    template: "%s — TryAnneal",
  },
  description: OG_DESC,
  applicationName: "TryAnneal",
  keywords: ["smart contract audit", "Mantle", "ERC-8004", "AI agents", "is_this_safe", "on-chain attestation", "MCP", "web3 security"],
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    url: "https://tryanneal.xyz",
    siteName: "TryAnneal",
    title: OG_TITLE,
    description: OG_DESC,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "TryAnneal — is_this_safe() · the trust layer for autonomous software" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@tryanneal",
    creator: "@tryanneal",
    title: OG_TITLE,
    description: OG_DESC,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
