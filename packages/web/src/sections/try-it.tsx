import SectionContainer from "../components/section-container";
import SectionHeader from "../components/section-header";
import SafetyOracle from "../components/safety-oracle";

/**
 * "Try it" — the is_this_safe() primitive, live. Visitors query a real
 * on-chain verdict from the AnnealValidation registry, no keys, no SDK.
 */
export default function TryItSection() {
  return (
    <section id="try" style={{ paddingTop: "96px", paddingBottom: "96px", scrollMarginTop: "80px" }}>
      <SectionContainer>
        <div className="flex flex-col items-center text-center mb-10">
          <SectionHeader
            label="Try it live"
            title={<>is_this_safe()</>}
            className="items-center"
          />
          <p
            className="font-mono mt-4 max-w-xl"
            style={{ fontSize: "13px", color: "var(--color-subtle-ash)", lineHeight: 1.6 }}
          >
            The same call any agent makes before composing with unknown code. Read a verdict straight
            from the on-chain registry on Mantle — pick an example or paste a code hash.
          </p>
        </div>
        <SafetyOracle />
      </SectionContainer>
    </section>
  );
}
