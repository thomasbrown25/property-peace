# Brownstone Hub Monorepo Standards

## Purpose
This repository is a monorepo containing multiple applications and shared packages for the Brownstone Hub platform.

Primary projects include:
- `property-peace-api` - ASP.NET Core backend API
- `property-peace-app` - main web frontend
- `brownstone-hub-mobile` - mobile application
- `brownstone-hub-mobile-tenants` - tenant-focused mobile application
- `shared` - shared code and cross-project utilities

When making changes:
- Prefer the smallest safe change that solves the problem
- Avoid broad refactors unless explicitly requested
- Preserve existing architecture patterns unless there is a clear reason to improve them
- Do not introduce unnecessary abstractions

## General Engineering Principles
- Favor readability and maintainability over cleverness
- Keep business rules explicit
- Avoid duplicate logic across apps when it belongs in shared code
- Respect package boundaries and project responsibilities
- Do not break public contracts without clearly calling it out

## Monorepo Expectations
- Before changing shared code, consider downstream impact on all consumers
- Keep project-specific logic in the owning project unless it is truly reusable
- Avoid coupling frontend concerns into backend/shared packages
- Avoid moving code across packages unless there is a strong architectural reason

## Change Discipline
- For larger tasks, first identify:
  - the affected project(s)
  - the relevant files/modules
  - the likely impact surface
- Prefer incremental updates over sweeping rewrites
- Call out assumptions when context is missing

## Review Priorities
Prioritize feedback in this order:
1. Correctness
2. Security
3. Reliability
4. Maintainability
5. Performance
6. Consistency with existing patterns

## Backend
For backend/API-specific standards, also consult:
- `property-peace-api/CLAUDE.md`

## Frontend
For frontend work:
- keep components focused
- avoid unnecessary global state
- prefer clear data flow
- handle loading, empty, and error states

## Shared Code
- Shared packages should remain framework-appropriate and narrowly scoped
- Do not place app-specific business rules into shared libraries unless intentionally designed for reuse
- Be cautious when changing shared interfaces, helpers, DTOs, or models

## What to Avoid
- Massive speculative refactors
- Renaming files/classes without a good reason
- Mixing unrelated cleanup into feature work
- Silent contract changes between frontend and backend
- Duplicating logic that already exists in a shared location