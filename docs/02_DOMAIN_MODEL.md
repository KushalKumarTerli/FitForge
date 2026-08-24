# Domain Model

---

## User

Represents an authenticated athlete.

Owns:

Workout Plans

Workout Sessions

Settings

---

## Workout Plan

Represents a reusable training template.

Example

Hybrid Home Workout

A plan consists of multiple workout days.

---

## Workout Day

Represents a logical training day.

Examples

Push

Pull

Legs

Recovery

Contains multiple exercises.

---

## Exercise

Master catalog of exercises.

Examples

Push Ups

Romanian Deadlift

Chair Dips

Exercises are reusable.

---

## Workout Session

Represents one performed workout.

Created when user taps:

Start Workout

Contains

Date

Duration

Status

Exercises

Notes

---

## Workout Session Exercise

Stores actual workout performance.

Examples

Expected

3 × 12

Actual

3 × 15

Weight

15kg

Completed

true

---

## Exercise Category

Groups exercises.

Examples

Push

Pull

Legs

Core

Cardio

Mobility

---

## Settings

Stores user preferences.

Theme

Units

Rest Timer

Notifications

---

## Core Principle

Workout Plans are templates.

Workout Sessions are history.

Workout history should never modify templates.