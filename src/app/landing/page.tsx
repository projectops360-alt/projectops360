import { Hero } from "@/components/landing/hero";
import { Capabilities } from "@/components/landing/capabilities";
import { Methodology } from "@/components/landing/methodology";
import { Industries } from "@/components/landing/industries";
import { Comms } from "@/components/landing/comms";
import { AiSection } from "@/components/landing/ai-section";
import { Quote } from "@/components/landing/quote";
import { About } from "@/components/landing/about";
import { Pricing } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";
import { getPublicPricingPlans } from "@/lib/billing/public-plans";

export const revalidate = 300;

export default async function LandingPage() {
  const plans = await getPublicPricingPlans();

  return (
    <>
      <Hero />
      <main>
        <Capabilities />
        <Methodology />
        <Industries />
        <Comms />
        <AiSection />
        <Quote />
        <About />
        <Pricing plans={plans} />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
