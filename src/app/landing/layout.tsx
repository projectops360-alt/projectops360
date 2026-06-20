import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "@/components/landing/landing.css";
import { LandingI18nProvider } from "@/components/landing/i18n/provider";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ProjectOps 360° — Operational intelligence for project-driven organizations",
  description:
    "Unify planning, execution, risk and workforce analytics into a single command center. Full visibility. Zero blind spots.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bricolage.variable} ${hanken.variable} lp-root min-h-screen w-full overflow-x-hidden`}>
      <LandingI18nProvider>{children}</LandingI18nProvider>
    </div>
  );
}
