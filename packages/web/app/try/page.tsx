import type { Metadata } from "next";
import Nav from "../../src/components/nav";
import Footer from "../../src/components/footer";
import SectionContainer from "../../src/components/section-container";
import JudgeFlow from "../../src/components/judge-flow";

export const metadata: Metadata = {
  title: "Try it — audit a contract",
  description:
    "Paste a smart contract and watch TryAnneal answer one question — is this safe? — in plain English, in seconds. No wallet, no keys.",
};

export default function TryPage() {
  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen bg-deep-space">
        <SectionContainer style={{ paddingTop: "72px", paddingBottom: "96px" }}>
          <JudgeFlow />
        </SectionContainer>
      </main>
      <Footer />
    </>
  );
}
