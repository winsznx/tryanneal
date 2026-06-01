import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Providers from "./providers";
import "../src/styles/theme.css";

export const metadata: Metadata = {
  title: "TryAnneal — Agent Trust Infrastructure",
  description:
    "Multi-LLM smart contract auditing with on-chain attestation on Mantle. Audit in seconds, attest on-chain, ship with confidence.",
  openGraph: {
    title: "TryAnneal — Agent Trust Infrastructure",
    description: "Audit smart contracts. Attest on-chain. Ship with confidence.",
    siteName: "TryAnneal",
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
