import type { Metadata } from "next";
import { Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import "@/components/landing/landing.css";
import { LandingI18nProvider } from "@/components/landing/i18n/provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project Ops 360° — Operational Intelligence for Project-Driven Organizations",
  description:
    "Unify planning, execution, risk management, and workforce analytics into a single command center. Full visibility. Zero blind spots.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${spaceGrotesk.variable} ${jakarta.variable} lp-root min-h-screen w-full overflow-x-hidden`}>
      <LandingI18nProvider>{children}</LandingI18nProvider>
    </div>
  );
}
