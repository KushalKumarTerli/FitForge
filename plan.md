# FitForge — Build Plan

*A mobile-first, AI-ready fitness operating system. Not a workout tracker — a platform.*

## Assumptions (confirm or correct before Sprint 1 starts)

| Area | Assumption | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite, Tailwind CSS, shadcn/ui, React Router | Matches the folder structure and UI style in the brief |
| Backend | Supabase (Postgres, Auth, Storage, RLS) | Explicitly requested |
| Delivery | Responsive mobile-first **web app** (not native iOS/Android) | "Mobile-first" was specified, not React Native/Expo |
| Coding agent | Not yet specified | skills.md is written to work with any agent (Claude Code, Cursor, etc.) |
| Package manager | npm | Default — swap if you use pnpm/yarn |

Update this table once your repo exists. Everything below assumes it's correct — if the stack is actually Next.js or you're going native, say so before Sprint 1 starts, since it changes the folder structure in §2.

---

## 1. Vision

FitForge is a fitness operating system, not a single-purpose tracker: workouts, nutrition, body progress, strength analytics, and eventually an AI coach — built on a proper multi-table domain model instead of a handful of flat tables.

## 2. Architecture: Modules, Not Pages

Each domain owns its own tables, types, hooks, services, and components. Nothing reaches into another module's internals directly — cross-module communication goes through `services/supabase` and shared `types`.

```
src/
  app/              # routing, providers, layout shell
  components/       # shared, generic UI only (buttons, cards, nav)
  modules/
    authentication/
    workouts/       # workout engine + exercise engine
    calendar/       # view-only, reads workout_sessions
    progress/       # body measurements, photos
    nutrition/
    statistics/     # PRs, volume, 1RM, streaks
    admin/
    settings/
  hooks/            # cross-module hooks only
  services/
    supabase/       # client + typed queries, one file per table group
  types/            # generated + hand-written shared types
  utils/
  styles/
  assets/
```

## 3. Module → Table Ownership

| Module | Owns tables | Notes |
|---|---|---|
| Authentication | `profiles` | Auto-created via trigger on `auth.users` insert. Add a `role` (`user`/`admin`) column here — needed for Sprint 3 admin gating, not in the original table list but required for it to work. |
| Exercise Engine (`workouts/`) | `exercise_categories`, `muscle_groups`, `exercises`, `exercise_media` | Reference data — public read, admin write |
| Workout Engine (`workouts/`) | `workout_plans`, `workout_plan_days`, `workout_plan_exercises`, `workout_sessions`, `workout_session_exercises` | User-owned, RLS on `user_id` |
| Calendar | *(none — reads `workout_sessions`)* | View layer only, no owned tables |
| Progress | `body_measurements` | Phase 3 |
| Nutrition | `nutrition_logs`, `meal_logs`, `protein_logs`, `water_logs` | Phase 2 |
| Statistics | `personal_records` | Phase 4 — streaks/volume are computed from Workout Engine data, may not need extra tables beyond PRs |
| Admin | *(none — privileged UI over Exercise + Workout Engine tables)* | Gate by `profiles.role = 'admin'` |
| Notifications | `notifications` | Later phase |
| AI Coach | TBD | Phase 5 — architecture-ready only, no tables yet |

## 4. Roadmap: Phases → Sprints

The brief lists both product **phases** (feature areas) and **sprints** (execution order). Here's the mapping:

| Sprint | Focus | Product phase(s) covered |
|---|---|---|
| 1 | Foundation — Supabase, schema, auth, workout engine core, calendar logic | Phase 1 (core) |
| 2 | Workout experience — exercise cards, auto-save, rest timer, session summary, history | Phase 1 (cont'd) |
| 3 | Admin CMS — exercise management, plan builder, drag-drop days, settings | Phase 1 (admin) |
| 4 | Analytics — charts, streaks, volume, PRs | Phase 4 |
| 5 | Nutrition & AI groundwork — protein/water/calories, AI coach architecture | Phase 2 + Phase 5 (foundation only) |

Phase 3 (Progress: weight, measurements, photos) and Phase 6 (Community) don't have a named sprint yet. Slot Progress in after Sprint 2 or alongside Sprint 4 — it's low complexity. Treat Community as backlog, not scheduled.

## 5. Sprint 1 — Detailed Checklist (start here)

**Setup**
- [ ] Scaffold repo with the module folder structure above
- [ ] Connect Supabase client, typed via `supabase gen types typescript`
- [ ] `.env` wired for `SUPABASE_URL` / `SUPABASE_ANON_KEY` (you'll supply these)

**Schema — Sprint-1 tables only**
- [ ] `profiles` (+ trigger to auto-insert on signup, + `role` column)
- [ ] `exercise_categories`, `muscle_groups`, `exercises`, `exercise_media`
- [ ] `workout_plans`, `workout_plan_days`, `workout_plan_exercises`
- [ ] `workout_sessions`, `workout_session_exercises`
- [ ] RLS policies on every user-owned table (`auth.uid() = user_id`); reference tables public-read, admin-write
- [ ] Seed 15–20 sample exercises for local dev

**Auth**
- [ ] Sign up / sign in / sign out
- [ ] Session persistence

**Workout core**
- [ ] Home screen shell: bottom nav (Home / Workout / Calendar / Progress / More)
- [ ] "Today's workout" card wired to real `workout_sessions` data
- [ ] Start Workout → creates a session + session_exercises rows
- [ ] Exercise completion with auto-save (debounced, not on every keystroke)
- [ ] Calendar heatmap (GitHub-style) reading `workout_sessions`
- [ ] Streak calculation
- [ ] Workout history list + detail view

**Definition of done for Sprint 1**
- Typecheck + lint pass
- A second test user cannot read/write the first user's rows (manual RLS check)
- A full workout can be started, completed, and shows up correctly in calendar + history

## 6. Non-goals right now

Don't build yet, even if it looks easy to bolt on: AI coach logic, wearable integrations, community features, notifications engine. Architecture shouldn't block them later, but no code until their sprint comes up — see skills.md Golden Rule #2.

## 7. Open questions for when you're back

- Next.js vs. Vite (changes what the `app/` folder means)
- Existing repo/starter, or greenfield?
- Which coding agent will drive this — matters for how you wire up skills.md (e.g. Claude Code auto-loads a root `CLAUDE.md`)
