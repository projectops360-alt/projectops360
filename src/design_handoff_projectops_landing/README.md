# Handoff: ProjectOps 360° — Landing (Dark Command Center)

## Overview
Redesigned marketing landing page for **ProjectOps 360°**, an operational-intelligence / execution platform for project-driven organizations (PMOs, project directors). This is the "dark command center" direction: a near-black forest hero with luminous emerald accents, a live "Execution Map" product mockup, followed by Capabilities, Methodology, social proof, and a final CTA.

## About the Design Files
The file in this bundle (`ProjectOps Landing.dc.html`) is a **design reference created in HTML** — a prototype showing the intended look, copy, and motion. It is **not production code to copy directly**. The component runs on a small internal "Design Component" runtime (`<x-dc>`, `data-reveal`, a `Component extends DCLogic` class); ignore that wrapper.

The task is to **recreate this design in the ProjectOps codebase** (the live site is Next.js on Vercel — `projectops360.vercel.app`) using its existing patterns, component library, and conventions. If a design system already exists in the repo, map the tokens below onto it rather than introducing new primitives. Treat the HTML purely as a visual + behavioral spec.

`reference_original_landing.png` is the **previous/original** hero for context (what we replaced).

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, layout, and interactions are intentional. Recreate pixel-close. Exact hex values, font families, and sizes are listed in **Design Tokens**.

## Page Structure (top → bottom)
Full-width single column. Section backgrounds alternate dark → light → dark → light → CTA card → dark footer. Content max-width **1180–1240px**, centered, horizontal padding **40px**.

### 1. Hero (`<section>` — dark)
- **Background:** `#07120D` with two decorative layers (both `position:absolute`, `pointer-events:none`):
  - Faint grid: two crossing `linear-gradient` lines, `rgba(60,229,164,.045) 1px`, `background-size:48px 48px`, animated `gridDrift` (translates the background-position by 48px over 9s linear infinite).
  - Top radial glow: `900×580px`, `radial-gradient(ellipse, rgba(31,181,135,.38), transparent 64%)`, `blur(34px)`, animated `glowPulse` (opacity .5→1, 7s).
  - Bottom fade: `linear-gradient(180deg, transparent 60%, #07120D)` to blend into mockup.
- **Nav** (max-width 1240, padding 24px 40px, flex space-between):
  - Logo: 32px rounded-10 square, `linear-gradient(150deg,#3CE5A4,#0C3A2A)`, glyph "◎" in `#06231a`; wordmark "ProjectOps" white + "360°" in `#3CE5A4`. Font Bricolage Grotesque 800, 20px.
  - Center links: Features · Methodology · Teams · Pricing — Hanken Grotesk 600, 15px, `#B8C7BF`, hover `#fff`.
  - Right: EN/ES pill toggle (active EN = `#3CE5A4` bg / `#06231a` text; inactive ES = `#9FB0A6`), "Sign in" text, "Request access" button (`#3CE5A4` bg, `#06231a` text, 700, padding 12px 22px, radius 100px, hover lifts -1px with stronger shadow).
- **Hero copy** (centered, max-width 1100):
  - Badge pill: `rgba(60,229,164,.1)` bg, `1px solid rgba(60,229,164,.3)`, text `#3CE5A4` 700/13.5px, pulsing 8px dot. Copy: "Private beta · Execution platform".
  - **H1:** Bricolage Grotesque **800, 82px, line-height .96, letter-spacing -.03em**. Four lines: "Operational" / "intelligence for" (white `#fff`) / "project-driven" / "organizations." — the last two lines use a clipped gradient `linear-gradient(100deg,#3CE5A4,#1FB587 72%)` (`-webkit-background-clip:text;color:transparent`).
  - Subhead: Hanken 20px, `#A9BAB1`, max-width 620, line-height 1.55. "Unify planning, execution, risk and workforce analytics into a single command center." + bold white "Full visibility. Zero blind spots."
  - CTAs (flex, gap 14): primary "Request early access →" (`#3CE5A4`/`#06231a`, 800/16px, padding 17px 30px, radius 100, shadow `0 18px 38px -12px rgba(60,229,164,.65)`, hover -2px); secondary "▶ See how it works" (transparent, `1.5px solid rgba(255,255,255,.18)`, white, small ▶ chip in `rgba(60,229,164,.16)`).
- **Product mockup — "Execution Map"** (max-width 1040, margin-top 50px, animated `floatY` ±9px over 8s):
  - Panel: `linear-gradient(165deg,#0E1512,#0A0F0C)`, `1px solid rgba(60,229,164,.18)`, top corners radius 20, padding 22/24/28, shadow `0 -10px 70px -22px rgba(60,229,164,.3), 0 50px 90px -30px rgba(0,0,0,.8)`.
  - Header row: 3 traffic-light dots (`#FF5F57 #FEBC2E #28C840`), title "Execution Map" (`#E7EFEA` 700/13.5), and a "Live" badge with blinking dot (`#3CE5A4`, `blink` 1.6s).
  - **6-card grid** (`repeat(6,1fr)`, gap 11). Each card: `linear-gradient(160deg,#13201A,#0E1512)`, `1px solid rgba(60,229,164,.12)`, radius 14, padding 14. Contents per card: small uppercase phase label (8px/800, `#6F8278`), title (12px/700, `#E7EFEA`), a **conic-gradient progress ring** (42px outer, conic `#3CE5A4 <pct>%, rgba(255,255,255,.07) 0`, inner 31px `#101A15` circle with % text 9px/800), and a tasks count (12.5px/800).
    - Card 1 **Charter & Gov.** — highlighted: border `rgba(60,229,164,.4)`, glow shadow, label "CURRENT" in `#3CE5A4`, ring 94%, 17/18, accent green.
    - Card 2 **Framework** — 100%, 9/9. Card 3 **Plan & Team** — 100%, 8/8.
    - Card 4 **Execution** — amber variant: bg `linear-gradient(160deg,#1E1A12,#13110C)`, border `rgba(226,163,60,.35)`, label "ACTIVE" `#E2A33C`, ring `#E2A33C 71%`, 12/17, text `#E2A33C`.
    - Card 5 **Living Memory** — 100%, 24/24. Card 6 **Reporting** — 88%, 7/8.
  - Footer row (border-top `rgba(255,255,255,.06)`): left "◈ Active memory · always searchable"; right 3 stats — **1,243** Decisions, **78** Risks, **93%** Traceability (93% in `#3CE5A4`).
- **Logos strip** (within hero, padding 34/40/56, flex centered, gap 44): label "Teams in our private beta" (`#5E7269`) + NorthPeak · Vela Labs · Quanta · Orbital · Lumen PMO (Bricolage 700/19, `#7E9389`).

### 2. Capabilities (`<section>` — light `#F6F8F6`, padding 96/40)
- Header row (flex, space-between, align-end): left = eyebrow "CAPABILITIES" (13px/800, `.16em`, uppercase, `#1FB587`) + H2 "Context, execution and memory — in one place." (Bricolage 800, 46px, lh 1.04, ls -.025em, `#10271E`, max-width 620, `text-wrap:balance`); right = supporting paragraph (17px, `#5C6B62`, max-width 340).
- **3×2 card grid** (`repeat(3,1fr)`, gap 20). Card: `#fff`, `1px solid #E7ECE8`, radius 18, padding 30, hover `translateY(-4px)` + shadow `0 22px 44px -24px rgba(12,58,42,.35)`, transition .3s.
  - Each card: 46px rounded-13 icon tile `#EAF6F0` with a 22px line-icon stroked `#1FB587` (1.8), H3 (Bricolage 700/21, `#10271E`), body (15px, `#5C6B62`, lh 1.55).
  - Cards: **Charter & governance** (clipboard-check), **Hybrid framework** (refresh-cycle), **Living memory** (database), **Risk radar** (shield-alert), **Workforce analytics** (bar-chart), **Execution map** (4-square grid). Exact copy is in the HTML.

### 3. Methodology (`<section>` — dark `#0A1611`, padding 96/40)
- Center radial glow `rgba(31,181,135,.16)`, blur 40.
- Centered header: eyebrow "METHODOLOGY" (`#3CE5A4`) + H2 "One framework. Every methodology your projects need." (white, Bricolage 800/46, max-width 640).
- **6-node horizontal pipeline** (`repeat(6,1fr)`): a dashed connector line (`repeating-linear-gradient(90deg, rgba(60,229,164,.5) 0 8px, transparent 8px 16px)`) sits behind the nodes at top:13px, inset 8%. Each node: 28px circle, `#0A1611` fill, 2px border, inner dot. Active nodes (Charter green `#3CE5A4`, Execution amber `#E2A33C`) get a `0 0 0 5px rgba(...,.12)` halo; others use `rgba(60,229,164,.4)` border. Labels white 15/700 + sublabel 12px `#6F8278`. Nodes: Charter/Governance · Framework/Agile-Waterfall · Plan & Team/Capacity · Execution/In progress · Living Memory/Searchable · Reporting/Traceability.
- **3 stat cards** below (gap 20): `rgba(255,255,255,.03)`, `1px solid rgba(60,229,164,.14)`, radius 18, padding 28. Big number Bricolage 800/34 `#3CE5A4` + caption 15px `#A9BAB1`: **93%** traceability · **1,243** decisions · **0** blind spots.

### 4. Proof / Quote (`<section>` — white, padding 96/40)
- Centered pull-quote, Bricolage 600/34, lh 1.3, `#10271E`, max-width 880; phrase "same source of truth" in `#1FB587`. Attribution: 46px gradient avatar "D", "Daniela Ortiz" (15/700), "Head of PMO · NorthPeak" (14, `#7B877F`). *(Placeholder testimonial — replace with a real quote.)*

### 5. CTA (`<section>` — green card, padding 0/40/96)
- Rounded-30 card, `linear-gradient(150deg,#0C3A2A,#06231a)`, padding 80/60, centered. Same faint grid overlay + bottom radial glow as hero. Badge "Private beta · limited seats", H2 "Bring full visibility to every project you run." (Bricolage 800/54, white), subhead (`#A9BAB1`), two CTAs: "Request early access →" (mint) + "Book a walkthrough" (ghost).

### 6. Footer (`#07120D`, border-top `rgba(255,255,255,.06)`, padding 54/40)
- Flex space-between: logo, link row (Features · Methodology · Teams · Pricing · Privacy, `#7E9389`), "© 2026 ProjectOps 360°".

## Interactions & Behavior
- **Scroll reveal:** elements marked `data-reveal` start `opacity:0; translateY(20px)` and animate to `opacity:1; translateY(0)` on entering the viewport — `transition: opacity .8s / transform .8s cubic-bezier(.2,.7,.2,1)`, observed via IntersectionObserver (threshold .12, rootMargin `0 0 -8% 0`), staggered by `(index % 6) * 0.07s`. Implement with a reusable hook/component (e.g. framer-motion `whileInView` or an IO hook).
- **Continuous animations** (CSS keyframes): `floatY` (mockup bob ±9px / 8s), `glowPulse` (glow + badge dots, opacity .5↔1), `gridDrift` (grid pan, 9s linear), `blink` (Live dot, 1.6s). Respect `prefers-reduced-motion` — disable in the real build.
- **Hover states:** nav links → white; primary buttons lift `translateY(-2px)` with intensified shadow; capability cards lift `-4px` + shadow; ghost buttons get `rgba(255,255,255,.06)` fill.
- **EN/ES toggle** is visual only here — wire to real i18n (the original supports `/landing` with EN/ES).
- All CTAs currently inert — wire "Request early access / access" to the access-request flow and "See how it works / Book a walkthrough" to demo.
- **Responsive (not in mock — must be built):** below ~900px, collapse the hero grid → single column, the Execution Map 6-col grid → 2–3 cols (or horizontal scroll), capabilities 3-col → 1, methodology pipeline → vertical timeline, nav → hamburger. H1 should scale down (clamp ~40–82px).

## State Management
Minimal — this is a marketing page. Needed: i18n language state (EN/ES), reveal-on-scroll (per-element, no global store), CTA modal/route triggers. No data fetching required (mockup numbers are static display copy).

## Design Tokens
**Colors**
- Forest base / page dark: `#07120D`
- Methodology dark: `#0A1611`
- Panel darks: `#0E1512`, `#0A0F0C`, `#101A15`, card grad `#13201A`→`#0E1512`, highlight `#15241D`
- Deep brand green: `#0C3A2A`; deeper `#06231a`
- Emerald: `#1FB587`; primary accent / mint: `#3CE5A4`; teal mid `#1FA97A`
- Amber (in-progress / warning): `#E2A33C`; amber panel `#1E1A12`→`#13110C`, text `#F5E9D4`
- Light section bg: `#F6F8F6`; card `#fff`; card border `#E7ECE8`; icon tile `#EAF6F0`
- Ink text: `#10271E`; muted (light) `#5C6B62`, `#7B877F`; muted (dark) `#A9BAB1`, `#B8C7BF`, `#6F8278`, `#7E9389`, `#5E7269`
- Traffic lights: `#FF5F57`, `#FEBC2E`, `#28C840`

**Typography**
- Display/headings: **Bricolage Grotesque** (Google), weights 600–800. H1 82px, H2 46–54px, card H3 21px, quote 34px. Letter-spacing -.025 to -.03em on big heads.
- Body/UI: **Hanken Grotesk** (Google), weights 400–800. Body 15–20px, lh 1.5–1.55.
- Eyebrows: 13px / 800 / letter-spacing .16em / uppercase.

**Spacing / radius / shadow**
- Section vertical padding 96px; content max-width 1180–1240; horiz padding 40px.
- Radii: buttons/pills 100px; cards 14–18px; CTA card 30px; logo tile 9–10px; icon tile 13px.
- Card hover shadow `0 22px 44px -24px rgba(12,58,42,.35)`; primary button `0 18px 38px -12px rgba(60,229,164,.65)`; mockup `0 50px 90px -30px rgba(0,0,0,.8)` + mint top-glow.
- Grid overlay: `48px 48px` (hero), `42px 42px` (CTA).
- Progress ring: conic-gradient, accent vs `rgba(255,255,255,.07)` track, inner circle matches card bg.

## Assets
- **No raster assets required.** Logo mark is a CSS gradient tile + "◎" glyph — recreate as a proper SVG logo in the real build. All capability icons are inline stroked SVGs (1.8 stroke, `#1FB587`) — swap for the codebase's icon library (lucide/heroicons equivalents: clipboard-check, refresh-cw, database, shield-alert, bar-chart-3, layout-grid).
- Fonts: load **Bricolage Grotesque** + **Hanken Grotesk** from Google Fonts (or self-host via next/font).
- Testimonial avatar is a CSS initial — replace with a real headshot or keep as initials.
- `reference_original_landing.png` = the previous landing (context only, do not implement).

## Files
- `ProjectOps Landing.dc.html` — the hi-fi design reference (open in a browser to view; the dark hero is the build target).
- `reference_original_landing.png` — original landing screenshot (before).
