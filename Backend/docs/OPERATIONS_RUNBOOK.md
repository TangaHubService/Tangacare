# Operations runbook (production baseline)

## Roles

- **Incident lead:** name and deputy in your deployment sheet.
- **DBA / backup owner:** verifies automated backups and restore drills.

## MFA and privileged access

- Enforce MFA for `SUPER_ADMIN`, tenant `OWNER`, and any break-glass accounts.
- Disable shared credentials; rotate API keys on a schedule.

## Backups and recovery

- **RPO/RTO:** set explicitly per tenant (defaults are not prescribed in software).
- **Monthly:** restore a backup copy into a non-production environment and run smoke tests (login, list stock, create draft PO).
- **Evidence:** store restore checklist sign-off (who, when, result).

## Alerting and out-of-band (OOB)

- Critical pharmacy alerts (recall, cold-chain excursion, expired stock) must be visible **in-app** and via at least **one OOB channel** (email/SMS) per site policy.
- Use `GET /api/pharmacy/alerts/delivery-logs` to audit channel delivery (`AlertDeliveryLog`: `sent`, `failed`, `skipped`).
- `InventoryNotificationService` logs email attempts for recall and related workflows; ensure user profiles have valid email for duty roles.

## Disaster recovery

- Document failover for application host, database, and object storage (if used for attachments).
- Run an annual tabletop exercise including **recall drill** and **expiry block** verification.
