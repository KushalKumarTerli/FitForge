# FitForge

Mobile-first fitness operating system. See [plan.md](./plan.md) for the roadmap and [CLAUDE.md](./CLAUDE.md) for agent operating rules.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Supabase (local dev)

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start          # spins up local Postgres, Auth, Studio
supabase db reset        # applies supabase/migrations + supabase/seed.sql
```

To point the app at a hosted Supabase project instead, put that project's URL/anon key in `.env`.

Regenerate types after any schema change:

```bash
supabase gen types typescript --linked > src/types/database.ts
```

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck + production build
- `npm run typecheck` — TypeScript project check, no emit
- `npm run lint` — ESLint
