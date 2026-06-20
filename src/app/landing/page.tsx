import { Hero } from "@/components/landing/hero";
import { Capabilities } from "@/components/landing/capabilities";
import { Methodology } from "@/components/landing/methodology";
import { AiSection } from "@/components/landing/ai-section";
import { Quote } from "@/components/landing/quote";
import { Pricing } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <main>
        <Capabilities />
        <Methodology />
        <AiSection />
        <Quote />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
