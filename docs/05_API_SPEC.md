# FitForge API Specification

Version: 1.0

---

# Philosophy

The frontend should never access database tables directly.

All business logic should flow through a service layer.

Future versions may replace Supabase with a custom backend without changing the UI.

---

# Authentication

## Sign In

POST /auth/login

Response

User Session

---

## Sign Out

POST /auth/logout

---

## Current User

GET /me

Returns

Profile

Settings

Current Active Plan

Current Workout

---

# Workout Plans

## Get Plans

GET /workout-plans

Returns

[]

Workout Plans

---

## Get Active Plan

GET /workout-plans/active

Returns

Workout Plan

Workout Days

Exercises

---

## Create Plan

POST /workout-plans

---

## Update Plan

PATCH /workout-plans/:id

---

## Delete Plan

DELETE /workout-plans/:id

Soft Delete

---

# Exercises

GET /exercises

GET /exercises/:id

POST /exercises

PATCH /exercises/:id

DELETE /exercises/:id

Archive Only

---

# Workout Engine

## Start Workout

POST /workout-session/start

Input

Plan ID

Day ID

Output

Workout Session

Session Exercises

---

## Continue Workout

GET /workout-session/current

Returns active session

---

## Complete Exercise

PATCH /workout-session/exercise/:id

Body

Completed

Actual Sets

Actual Reps

Actual Weight

Notes

---

## Finish Workout

POST /workout-session/:id/complete

Updates

Status

Duration

Completion Time

Triggers next workout calculation

---

# History

GET /history

Returns

Completed Workouts

Missed Workouts

Recovery Days

---

# Calendar

GET /calendar

Returns

Daily Workout Status

Completed

Missed

Recovery

Future

---

# Statistics

GET /statistics

Returns

Current Streak

Longest Streak

Completed Workouts

Workout Count

Weekly %

Monthly %

---

# Settings

GET /settings

PATCH /settings

Theme

Units

Notifications

Default Rest Time

---

# Admin

CRUD

Exercise Categories

Exercises

Workout Plans

Workout Days

Workout Templates

Settings

---

# Future APIs

Nutrition

Progress

Photos

AI Coach

Notifications

Achievements

Wearables