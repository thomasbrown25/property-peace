# Project Standards

## Architecture
- Controllers should stay thin and delegate business logic to services.
- Services contain application/business logic.
- Repositories handle persistence only and should not contain business rules.
- Do not expose EF entities directly from API endpoints.

## DTOs
- Use request/response DTOs at API boundaries.
- Map entities to DTOs explicitly.
- Avoid leaking internal fields in response models.

## Auth / Authorization
- Use authenticated endpoints by default unless explicitly public.
- Prefer policy-based authorization over scattered role checks.
- Validate tenant/user ownership where applicable.

## EF Core
- Avoid N+1 query patterns.
- Avoid unnecessary `Include` chains and over-fetching.
- Use paging on list endpoints.
- Prefer server-side filtering/sorting.
- Be cautious with premature `ToList()` and client-side evaluation.

## Review Priorities
1. Correctness
2. Security
3. Maintainability
4. Performance