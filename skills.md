# Agent Operating Guide — FitForge

*Read once per session — kept short on purpose so re-reading it is cheap. If you're using Claude Code, consider copying this into `CLAUDE.md` at the repo root so it loads automatically.*

## 1. Golden rules

1. **One module at a time.** Work within the module/feature your current task touches (see plan.md §3). Don't edit files outside it.
2. **Current sprint only.** Build what plan.md's active sprint checklist says. Don't add Phase 2+ features "while you're in there," however easy it looks.
3. **Assume, don't stall.** If something's ambiguous, make the smallest reasonable assumption, note it in the commit message or a one-line status update, and keep going. Only stop and ask if genuinely blocked — see §7.
4. **Never touch secrets.** Don't print, log, or modify `.env` values. Read variable *names* only if strictly needed for code, never their values.
5. **Migrations are additive by default.** Never drop or alter an existing column without an explicit instruction to do exactly that.

## 2. Token & context discipline

This is the part that actually keeps sessions fast and cheap:

- Don't re-read the whole repo at the start of every task — read only what the current task touches.
- Reference files by path, not by pasting their full contents into your output.
- Edit with targeted diffs/patches, not full-file rewrites, when only a few lines change.
- Batch related schema changes into one migration file instead of several back-and-forth edits.
- Regenerate Supabase types once per schema change, not once per file touched.
- Keep commit messages and status updates short: what changed, why, what's next. Skip step-by-step narration of the process.
- No speculative refactors outside the assigned task ("while I was in there I also cleaned up X" — don't).
- Don't restate plan.md's architecture or vision in your own output — reference the section number instead.

## 3. Module boundaries

| Module | Owns tables | Notes |
|---|---|---|
| Authentication | `profiles` | Includes `role` column for admin gating |
| Exercise Engine | `exercise_categories`, `muscle_groups`, `exercises`, `exercise_media` | Public read, admin write |
| Workout Engine | `workout_plans`, `workout_plan_days`, `workout_plan_exercises`, `workout_sessions`, `workout_session_exercises` | User-owned via RLS |
| Calendar | *(none)* | Reads `workout_sessions` only |
| Progress | `body_measurements` | Phase 3 |
| Nutrition | `nutrition_logs`, `meal_logs`, `protein_logs`, `water_logs` | Phase 2 |
| Statistics | `personal_records` | Phase 4 |
| Admin | *(none)* | Privileged UI over Exercise + Workout Engine data |
| Notifications | `notifications` | Later phase |

Cross-module code goes through `services/supabase` and `types/` — never import one module's internal hooks or components from another module directly.

## 4. Conventions

- **DB:** snake_case, plural table names, `user_id` column on every user-owned table
- **TS:** PascalCase components, camelCase variables/functions, one component per file
- Prefer generated Supabase types over hand-written duplicates
- Module-specific hooks live in `modules/<name>/hooks`, not the shared top-level `hooks/`

## 5. Supabase guardrails

- RLS on by default for every table. Owner-scoped tables: `auth.uid() = user_id`. Reference tables (`exercises`, `exercise_categories`, `muscle_groups`): public read, write gated on `profiles.role = 'admin'`.
- All schema changes live in `supabase/migrations/`, one logical change per file. Never edit a migration that's already been applied — write a new one instead.
- Destructive operations (drop table/column, truncate) require an explicit instruction to do exactly that. Don't infer permission from a vague "clean this up."

## 6. UI guardrails

- Bottom nav is fixed: **Home / Workout / Calendar / Progress / More.** New top-level nav items need a plan.md update first, not a silent addition.
- Design mobile-first (375px baseline), then scale up.
- Use shadcn/ui + Tailwind utilities before reaching for custom CSS.
- Admin screens (`/admin/*`) can look like a dashboard/CMS; user-facing screens should not.

## 7. When to actually ask instead of assuming

Only interrupt the user for:
- Missing credentials/secrets that block progress
- A decision with real downstream cost if wrong (e.g. changing the RLS ownership model, altering a table already in production use)
- A request that contradicts a decision already locked in from a completed sprint

Everything else: pick the reasonable default, document it inline, keep moving.

## 8. End-of-sprint checkpoint

At the end of each **sprint** (not each task): give a short summary — what's done, what's deferred, what assumptions were made that need confirming. Wait for a go-ahead before starting the next sprint.
