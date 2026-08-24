# Database Schema

## profiles

id

full_name

avatar_url

height_cm

weight_kg

date_of_birth

goal

created_at

updated_at

---

## exercise_categories

id

name

description

icon

created_at

---

## exercises

id

category_id

name

description

equipment

difficulty

instructions

youtube_url

thumbnail_url

is_active

created_at

---

## workout_plans

id

name

description

is_active

created_at

updated_at

---

## workout_plan_days

id

plan_id

day_number

title

description

display_order

created_at

---

## workout_plan_day_exercises

id

day_id

exercise_id

sets

reps

default_weight

rest_seconds

display_order

notes

---

## workout_sessions

id

user_id

plan_id

day_id

status

started_at

completed_at

duration_seconds

notes

created_at

---

## workout_session_exercises

id

session_id

exercise_id

completed

actual_sets

actual_reps

actual_weight

notes

completed_at

---

## settings

id

user_id

theme

measurement_unit

default_rest_time

notifications

created_at