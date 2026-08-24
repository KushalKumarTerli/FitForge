# FitForge Development Guide

Version 1.0

---

# Project Philosophy

Write code for future developers.

Future developer = You in six months.

Code should explain itself.

---

# General Rules

Never duplicate logic.

Never duplicate components.

Never duplicate SQL.

Single source of truth.

---

# Folder Structure

Feature Based.

Never organize by file type.

Good

features/workout

features/calendar

features/admin

Bad

pages

components

utils

with unrelated files mixed together.

---

# Naming

Components

PascalCase

WorkoutCard.tsx

Hooks

camelCase

useWorkoutSession.ts

Variables

camelCase

Constants

UPPER_CASE

Types

PascalCase

Interfaces prefixed with I only if necessary.

---

# Database

UUID Primary Keys

Foreign Keys

Indexes

Soft Deletes

Timestamps

RLS Enabled

No duplicate data.

---

# React

Functional Components Only

Hooks Only

No Class Components

Reusable Custom Hooks

TanStack Query for server state

React State for UI state

---

# Forms

React Hook Form

Zod Validation

Controlled Components

Autosave

---

# Styling

Tailwind

shadcn/ui

No inline styles

No duplicated utility classes

Extract reusable variants.

---

# Error Handling

User Friendly

Meaningful

Retry where possible

Never expose SQL errors

---

# Logging

Development

Console

Production

Structured Logs

---

# Git

Small commits

Meaningful commit messages

Feature branches

Pull Requests

---

# Performance

Memoize expensive components

Lazy Loading

Optimistic Updates

Database Indexes

Image Optimization

---

# Security

Supabase Auth

RLS Everywhere

Validate Inputs

No client secrets

---

# Testing

Unit Tests

Integration Tests

Manual Mobile Testing

---

# Documentation

Every major module must include

README.md

Architecture Notes

Public API

---

# AI Rules

AI may generate code.

Developer reviews all code.

AI never defines architecture.

AI never changes database without approval.

---

# Definition of Done

Feature works.

Mobile tested.

Responsive.

Accessible.

Persisted.

No mock data.

No console errors.

No TODO comments.

Documentation updated.