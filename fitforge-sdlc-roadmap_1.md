# FitForge — Build & Fluency Roadmap

**Two goals, one project:**
1. Ship FitForge properly, following real SDLC.
2. Build hands-on fluency in Node/Express, React, TypeScript, SQL, REST APIs, and Supabase — plus the judgment to direct AI tools well — so you can talk through all of it in interviews.

## Current State
- [x] Supabase project created
- [ ] No app code yet
- plan.md / skills.md from earlier — paste them in if you still want to build on those; otherwise Phase 1 below rebuilds the essentials from scratch, which is normal since requirements evolve anyway.

## How We'll Work
- You write the code. I explain the "why," review what you write, and flag what a senior engineer or interviewer would flag.
- Every feature gets a small design pass before code — same discipline as directing an AI tool well, just applied by you first.
- After each phase: a quick "explain it back to me" pass. That's the real interview-readiness test.

## Roadmap

| Phase | Focus | Key Deliverable |
|---|---|---|
| 1. Requirements | MVP scope, user stories, non-functional requirements | Scope doc |
| 2. System Design | DB schema (ERD), API contracts, architecture decisions | schema.sql, API doc, short ADRs |
| 3. Implementation | Feature-by-feature build | Working app, iteratively |
| 4. Testing | Unit + integration tests | Test suite |
| 5. Deployment | CI/CD, hosting, git workflow | Live app |
| 6. Polish & Interview Prep | Trade-off writeups, mock Q&A | Talking points per feature |

### Implementation order (Phase 3)
Auth → App shell / navigation → Workout logging (core CRUD) → Nutrition → Body progress → Strength analytics → AI coach layer (post-MVP)

## Agentic Coding — the Parallel Skill
The real value isn't the prompt — it's:
- Writing a scoped spec an AI can execute against without guessing
- Reviewing AI output like a code review: correctness, security, style, edge cases
- Knowing when to write it yourself vs. delegate

We'll practice this by writing a short mini-spec for each feature before building it — the same document you'd eventually hand an AI pair programmer.

## Phase 1 — MVP Scope ✅ LOCKED

### Epics & User Stories

**Auth**
- As a new user, I can register and log in so my data is private to me (Supabase Auth + RLS).

**Dashboard**
- As a user, I see a calendar/week view with a streak score, today highlighted.
- As a user, I see today's assigned workout plan (one of 6 starter types: Push, Pull, Legs, + 3 more) with its exercise list.
- As a user, I can switch today's plan via a dropdown instead of the default.
- As a user, I can tap "Start Workout" to begin a timed session.

**Workout Session**
- As a user, I see exercises listed with sets/reps, and mark each done.
- As a user, once every exercise is marked done, the session completes and shows calories burnt (MET-based, using my body weight + exercise duration) and time spent.

**Custom Workout Plans**
- As a user, I can build my own workout plan: name it, add exercises, set sets/reps for each.

**Nutrition Tracking**
- As a user, I can describe a meal in free text ("2 rotis, dal, salad").
- An LLM parses that into estimated nutrients (calories, protein, carbs, fat).
- As a user, I see totals per meal and running totals for the day.

**Health Tips**
- As a user, I see health tips/suggestions, generated via LLM.

### Decisions Locked
1. **Nutrition input** → free-text meal description, parsed by an LLM (Mistral or similar).
2. **Calorie burn** → MET-based formula: `calories = MET × weight_kg × (duration_hours)`, using each exercise's MET value and the user's stored body weight.
3. **LLM integration** → live in MVP, powering both nutrition parsing and health tips.

**Worth knowing:** shipping LLM calls in the MVP path means Phase 2 needs to account for API latency, parsing failures (user describes something ambiguous), and a fallback so a bad LLM response never blocks a meal from being logged. Not a blocker — just something the schema and API design need to handle from the start rather than bolt on later.

### Non-functional requirements
- Mobile-first, responsive down to a single-column phone layout
- Auth-gated data — every table scoped to the logged-in user (Supabase RLS)
- Fast perceived load on dashboard (skeleton states, not blocking spinners)
- LLM calls must degrade gracefully (timeout/error → user can still save a manual fallback entry)

## Phase 2 — System Design (starting point)

Draft entities, grouped by epic — sanity-check this before we write actual schema.sql:

- **profiles** — user_id, weight_kg, height_cm, (extends Supabase auth.users)
- **exercises** — catalog: name, muscle_group, met_value, default_sets/reps
- **workout_plans** — id, user_id (null = system starter plan), name, type
- **plan_exercises** — plan_id, exercise_id, sets, reps, order
- **workout_sessions** — id, user_id, plan_id, date, started_at, completed_at, total_calories, total_duration_seconds
- **session_exercises** — session_id, exercise_id, completed (bool), completed_at
- **meals** — id, user_id, logged_at, raw_text, calories, protein_g, carbs_g, fat_g, parse_status
- **health_tips** — id, user_id, content, generated_at

Streaks: computed from `workout_sessions` (consecutive days with a completed session) rather than stored as its own table — fewer moving parts, no sync bugs.

Open question for you: does a "day" count toward the streak if only nutrition is logged, or does it require a completed workout?
