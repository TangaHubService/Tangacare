# OWASP ASVS-aligned review (Level 2, excerpt)

Use this checklist on releases that touch **auth**, **inventory**, **sales**, or **exports**. Record pass/fail in the PR.

## Authentication (V2)

- [ ] Password policy enforced; lockout / rate limit on login (see `express-rate-limit` and auth routes).
- [ ] Session/JWT expiry and refresh behaviour documented.

## Access control (V4)

- [ ] Sensitive routes use server-side `requirePermission` / `authorize` (not UI-only).
- [ ] `OWNER` bypass documented in [`RBAC.md`](RBAC.md); confirm no unintended bypass for tenant-scoped pharmacy APIs.

## Data protection (V9)

- [ ] TLS in production; database encryption at rest per host policy.
- [ ] Secrets not committed; environment variables for DB and mail transport.

## Logging & integrity (V7/V8)

- [ ] Financial and stock mutations emit audit events where required.
- [ ] `stock_movements` treated as append-only in application code (no updates/deletes).

## API (V13)

- [ ] Input validation on DTOs for pharmacy write endpoints (`class-validator`).
- [ ] Idempotency for payment-critical paths verified where implemented.
