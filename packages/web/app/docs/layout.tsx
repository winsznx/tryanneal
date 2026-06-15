import Nav from "../../src/components/nav";
import DocsShell from "./docs-shell";

export const metadata = {
  title: "TryAnneal — Docs",
  description: "Documentation for TryAnneal: the is_this_safe() primitive for the Mantle agent economy.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <DocsShell>{children}</DocsShell>
    </>
  );
}
