# Clinical Reasoning Engine — Project Instructions

## Package Manager
- Always use **pnpm**. Never use npm or yarn.
- Install: `pnpm install`, Add: `pnpm add`, Dev server: `pnpm dev`

## Tech Stack
- **Framework**: Next.js 14 (App Router, TypeScript, strict mode)
- **UI**: shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL (local) via **Prisma ORM**
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Seed**: `tsx` for running TypeScript scripts directly

## Frontend Architecture
- **Always reference `docs/code_principle.md`** before writing any UI or React code
- Strictly follow the L0–L5 layered architecture defined there
- L5 pages: zero className, zero inline styles — only block assembly
- L4 blocks: only CONSUME context, never MANAGE state
- L2.5 compound: only UI state (isOpen, activeTab), no business data
- All magic numbers → design tokens in globals.css or tailwind.config.ts
- All icon-only buttons must have `aria-label`
- All animations: transform/opacity only, support prefers-reduced-motion

## Key Commands
- `pnpm dev` — start Next.js dev server (port 3000)
- `pnpm db:migrate` — run `prisma migrate dev`
- `pnpm db:seed` — run `tsx scripts/seed.ts`
- `pnpm db:studio` — open Prisma Studio

## File Conventions
- Components: kebab-case filenames, named exports
- Types: defined in `types/index.ts`, imported from there
- API routes: `app/api/[resource]/route.ts`
- Prisma client: always import from `lib/db.ts` (singleton)
- Anthropic client: always import from `lib/ai.ts` (singleton)

## Environment Variables (.env.local)
- `DATABASE_URL` — local PostgreSQL connection string
- `ANTHROPIC_API_KEY` — Claude API key

## docs/code_principle.md
- Paste this file into the project after scaffolding
- It defines the full L0–L5 architecture with hard rules
- Must be consulted for every UI component decision
