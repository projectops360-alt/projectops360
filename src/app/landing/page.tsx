import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { SocialProof } from "@/components/landing/social-proof";
import { Features } from "@/components/landing/features";
import { Workflow } from "@/components/landing/workflow";
import { Testimonial } from "@/components/landing/testimonial";
import { Teams } from "@/components/landing/teams";
import { Pricing } from "@/components/landing/pricing";
import { Security } from "@/components/landing/security";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <Workflow />
        <Testimonial />
        <Teams />
        <Pricing />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
