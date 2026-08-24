# Project Log — Final Build Pass

Scope of this log: what this build pass (the "full build-out" spec — sections 0–6) added
on top of the existing app. For the original MVP scope, schema decisions, and phase plan,
see `fitforge-sdlc-roadmap_1.md`. **Note:** the spec for this pass asked to also reference
`CLAUDE.md` for schema/backend/RLS/deployment history — that file does not exist anywhere
in this repo (checked at the start and end of this pass), so backend/RLS details below come
from direct verification against the live Supabase project during this session, not from a
written doc. Worth creating one (`/init`) so future sessions have it.

Every section below was built, `tsc -b` type-checked, verified against the local dev server,
committed, pushed to `main`, and re-verified live at https://fit-forge-green.vercel.app
before the next section started, per the working agreement for this pass.

## 0. Carry-over check: desktop layout + timer prominence

Confirmed neither was actually in the code yet (the files matched exactly what was built in
the prior session, no desktop-specific breakpoints, no timer emphasis styling). Built to the
exact spec supplied directly in chat rather than freelanced:

- All 5 existing pages wrapped in a centered max-width container — `max-w-2xl mx-auto` for
  Login/Signup, `max-w-4xl mx-auto` for Dashboard/Workout/Nutrition. Mobile layout below `lg`
  unchanged.
- Dashboard's exercise list is a 2-column grid at `lg` (`grid-cols-1 lg:grid-cols-2`).
- Workout timer: `text-5xl`/`text-6xl`, centered, in its own card at the top.
- Set tap-targets enlarged (`min-h-16 min-w-24`, `border-2`) with a clear checked
  (filled primary) vs. unchecked (`bg-muted/40`) contrast.

**Infra fix found while verifying this section live:** Vercel had no SPA rewrite rule, so any
direct navigation to a client-side route other than `/` (a refresh, a bookmark, or this
session's own live-verification checks) hit Vercel's generic 404 instead of the app. Added
`frontend/vercel.json` with a catch-all rewrite to `index.html`. This wasn't part of the
original spec but blocked verifying *every other section* live, so it was fixed immediately
rather than deferred.

## 1. Full style guide (dark theme)

- `.dark` tokens in `src/index.css` updated to the brand guide's exact hex values (charcoal
  background/cards, green primary, lime accent). `<html class="dark">` in `index.html` so
  the app defaults to it.
- Bebas Neue imported and set as `--font-heading`, but scoped narrowly: removed the blanket
  `font-heading` the shared `CardTitle` component was applying to *every* card title, and
  applied it explicitly only to genuine page titles (Login/Signup headings) and the workout
  timer, per "page titles and the workout timer only." Body text (meal descriptions, exercise
  names, chat messages, etc.) stays Inter/Geist.
- `Button`: default variant is now a green gradient (`from-[#16A34A] to-[#22C55E]`) with a
  soft shadow; outline variant is lime border/text on transparent (the "View Progress" style
  from the guide).
- lucide-react icons added to nav (Dumbbell/Apple/LogOut, later MessageCircle/Settings as
  those pages were built) and the workout timer (Clock, next to Check on completed sets).

## 2. Health & Fitness Suggestions (`/health`)

New page: a 12-topic grid (Heart Health, Testosterone Booster, Strength Building, Mental
Health, Brain Sharpener, Fertility, Strength Training, Sexual Health, Hygiene, Skin Care,
Hair Care, Facial Shape — kept "Strength Building" and "Strength Training" as two distinct
buttons even though they're near-duplicates, since that's exactly what the spec listed).
Clicking a topic pre-fills (doesn't send) an editable starter question. Sending gets the
session's `access_token` and POSTs to the existing backend `/api/chat` (already implemented
server-side from an earlier session — no backend changes needed), then persists both the
user's message and the assistant's reply to `health_chat`. History loads and renders on
mount, ordered by `created_at`.

Verified live with a real (non-mocked) backend round-trip: response referenced the test
account's actual logged workouts and meals, confirming the backend's context-gathering
works end-to-end, not just the chat UI.

## 3. Calendar + streak (Dashboard)

Added above the plan picker. Status per day is derived live from `workout_sessions` /
`session_exercises` / `session_sets` — nothing new is stored. No session row → colorless; a
session exists but not every set is completed → amber; every set completed → glassy green
with a small checkmark. Streak counts consecutive days back from today with at least one
`workout_sessions` row, **regardless of completion status**.

**Deviation worth flagging:** `fitforge-sdlc-roadmap_1.md` left this as an open question and
leaned toward "requires a completed workout." The spec for this pass explicitly locked the
looser rule (any session counts) — implemented as instructed, documented here since it
contradicts the roadmap doc's lean.

**Bug found and fixed during live verification, not before:** repeated live testing showed
an intermittent false "0 day streak" with correct data underneath. Root cause:
`supabase.auth.getUser()` does a live network round-trip to re-verify the session, and
occasionally 401'd right after a fresh sign-in (a race with another component's concurrent
auth call); the component treated the resulting null user as "no data" and silently
defaulted to zero instead of surfacing an error. Fixed by switching to
`supabase.auth.getSession()` (reads the already-established local session, no network race)
and by explicitly checking both Supabase query results for errors and rendering a retryable
error state instead of ever silently showing zero. Confirmed with 5 consecutive clean local
runs and 6 consecutive clean live runs after the fix.

## 4. Custom Workout Plan Builder (`/plans/new`)

Name + type, then a searchable exercise-catalog picker (client-side filter, no new
dependency). Each added exercise gets its own sets count and a single target value (reps or
duration, based on that exercise's `tracking_type`), which expands into the per-set array
the schema expects (`target_reps`/`target_duration_seconds` are arrays matching `sets`,
confirmed against the live table shape rather than the stale `database/schema.sql`).
Exercises can be reordered (up/down) or removed before submitting. Submitting creates one
`workout_plans` row owned by the current user plus matching `plan_exercises` rows.

Dashboard's plan query changed from `user_id is null` only to
`user_id is null OR user_id = <current user>`, so custom plans appear in the picker
alongside the 4 system plans (ordered after them via `nullsFirst: false` on
`sequence_order`, since custom plans have no sequence order).

## 5. Settings / Profile (`/profile`)

Edits `full_name`, `weight_kg`, `height_cm`, `phone_number` — verified working, both locally
and live. Avatar upload targets `avatars/${userId}/<filename>` exactly as specified and is
implemented correctly, but **is not working end-to-end**: it fails with a genuine Storage RLS
rejection (`403 AccessDenied: new row violates row-level security policy`) on the `INSERT`
into `storage.objects` — not a "bucket not found" error, and not a client-side bug. Per your
decision, this was left as-is rather than blocking the rest of the build; the upload code is
correct and should work once the bucket's INSERT policy is fixed (the exact issue and a
suggested policy were shared in chat during this session).

A shared `NavAvatar` component shows the current avatar (or a placeholder icon) in the nav
bar on Dashboard, Nutrition, and Health, next to a new Settings (gear) link to `/profile`.

## 6. Dashboard "what's next" hint

When a system plan is selected, a small subtitle shows the next plan in the sequence
(`sequence_order` 1→2→3→4→1). Purely informational, doesn't navigate. No hint shows for
custom plans, since they have no `sequence_order`. Verified across all 4 system plans
including the 4→1 wrap.

## Known open items

- Avatar upload blocked on the Storage RLS policy (section 5, above).
- No `CLAUDE.md` in the repo — this log leans on `fitforge-sdlc-roadmap_1.md` and this
  session's own direct verification instead.
