import Nav from "../src/components/nav";
import Footer from "../src/components/footer";
import HeroSection from "../src/sections/hero";
import HowItWorksSection from "../src/sections/how-it-works";
import FeaturesSection from "../src/sections/features";
import ComparisonSection from "../src/sections/comparison";
import ArchitectureSection from "../src/sections/architecture";
import CtaSection from "../src/sections/cta";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ComparisonSection />
        <ArchitectureSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
