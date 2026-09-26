# Accounts and sessions handoff

## Purpose

Provide optional nickname/password accounts and persistent identity for Tea After Pour while keeping the room usable by guests.

## Completed

- Registration, login, logout, and current-session endpoints.
- Nickname normalization and uniqueness, bcrypt password hashes, opaque hashed session tokens, and 30-day session expiry.
- HttpOnly, SameSite Lax cookies, Secure in production; Prisma schema and migration use SQLite.
- Guests can enter without an account. Account identity is available server-side as `user.id`.

## Remaining work

- Storage is local SQLite intended for one persistent server filesystem; choose and configure production storage before deployment.
- No password reset or email verification flow exists. No production deployment or security review is recorded.
- Apply the committed migration with `npm run db:migrate` in a new environment.

## Important files / architecture

- `prisma/schema.prisma`, `prisma/migrations/20260925205300_accounts_auth/migration.sql`: User and Session persistence.
- `src/auth/service.ts`, `validation.ts`, `cookie.ts`, `current-user.ts`, `http.ts`, `db.ts`: auth rules and server helpers.
- `src/app/api/auth/*`, `src/app/account/page.tsx`, `src/ui/AuthScreen.tsx`, `AccountMenu.tsx`: route and UI flow.
- `tests/auth-*.test.ts`, `tests/browser/auth.spec.ts`: unit and browser coverage.

## Validation performed

On `feature/accounts-auth`: `npm run typecheck`, `npm test` (6 files, 27 tests), and `npm run build` all passed on 25 September 2026.

## Recommended next steps

1. Review storage and session policy for the intended deployment environment.
2. Decide whether account recovery and email verification are required before public launch.
3. Apply migrations and run browser tests against the deployment-like environment.
