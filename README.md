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
| i18n | next-intl (ES / EN) |
| AI | OpenAI (planned) |

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css         # Brand tokens & Tailwind theme
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Dashboard home
├── components/
│   ├── layout/             # App shell, sidebar, header
│   ├── shared/             # Logo, shared components
│   └── ui/                 # shadcn/ui components
├── config/
│   ├── navigation.ts       # Sidebar & nav constants
│   └── site.ts             # Brand & site constants
├── hooks/                  # Custom React hooks
├── i18n/                   # next-intl config (Phase 1)
├── lib/
│   ├── supabase/           # Supabase clients (Phase 1)
│   ├── ai/                 # OpenAI service layer (Phase 2)
│   └── utils.ts            # cn() helper
├── middleware.ts           # i18n redirect (Phase 1)
├── styles/                 # Additional styles
└── types/                  # Global TypeScript types
```

## Brand

Soft green palette inspired by Ascendia — professional, modern, and accessible.

## License

Private — All rights reserved.