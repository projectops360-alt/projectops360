# ProjectOps360°

**Project Operations Management Platform**

A modern SaaS platform for project operations management, built by a solo founder with AI-powered insights.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + App Router |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Icons | Lucide React |
| Database & Auth | Supabase |
| i18n | next-intl (English / Español) |
| AI | OpenAI (planned) |

## Getting Started

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Supabase CLI ≥ 2.26

### Installation

```bash
# Clone the repository
git clone https://github.com/projectops360-alt/projectops360.git
cd projectops360

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=your_url
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Supabase Setup

```bash
# Login to Supabase
supabase login

# Link to the remote project
supabase link --project-ref ocopmlnkvidvmxgiwvxw
```

## Project Structure

```
src/
├── app/
│   ├── [locale]/              # i18n dynamic route (en, es)
│   │   ├── page.tsx           # Dashboard home
│   │   └── phase0/page.tsx    # Phase 0 Control page
│   ├── globals.css            # Brand tokens & Tailwind theme
│   └── layout.tsx             # Root layout
├── components/
│   ├── layout/                # AppShell, Sidebar, Header
│   ├── phase0/                # Phase 0 Control components
│   ├── shared/                # Logo, LanguageSwitcher, SupabaseStatus
│   └── ui/                    # shadcn/ui components
├── config/
│   ├── navigation.ts          # Sidebar & nav constants
│   └── site.ts                # Brand & site constants
├── data/
│   └── phase0-tasks.ts        # Phase 0 task definitions
├── hooks/
│   └── use-phase0-progress.ts # localStorage progress hook
├── i18n/
│   ├── routing.ts             # Locale routing config
│   ├── request.ts             # next-intl request config
│   └── navigation.ts          # i18n Link, useRouter, usePathname
├── lib/
│   ├── supabase/              # Browser + Server clients
│   ├── env.ts                 # Env var validation
│   └── utils.ts               # cn() helper
├── types/
│   └── phase0.ts              # Phase 0 TypeScript types
├── middleware.ts               # next-intl routing + Supabase auth refresh
messages/
├── en.json                    # English translations
└── es.json                    # Spanish translations
supabase/
├── config.toml                # Local Supabase config (linked to remote)
└── .temp/                     # Link metadata (gitignored)
```

## i18n

The app supports **English** (default) and **Spanish**.

- `/` or `/en` → English
- `/es` → Español

Translations live in `messages/en.json` and `messages/es.json`. Add new keys under a namespace and use `t("namespace.key")` in components.

## Environment Variables

Environment boundaries are mandatory:

- Local, Vercel Development and Preview use Supabase staging (`gcxcljfzleasrleyyyda`).
- Vercel Production uses Supabase production (`ocopmlnkvidvmxgiwvxw`).
- `npm run env:check` verifies the current environment without printing secrets.
- The complete release policy is in [`docs/product-brain/33-environment-release-operations.md`](docs/product-brain/33-environment-release-operations.md).

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Supabase anon key (safe for browser) |
| `DATABASE_URL` | Server-only | PostgreSQL connection string (contains password) |
| `OPENAI_API_KEY` | Server-only | OpenAI API key (Phase 2) |

**Never commit `.env.local` to git.** It is excluded via `.gitignore`.

## Phase 0 Status

Track progress on the [Phase 0 Control page](http://localhost:3000/phase0). Task status persists in localStorage.

## Brand

Soft green palette inspired by Ascendia — professional, modern, and accessible.

## License

Private — All rights reserved.
