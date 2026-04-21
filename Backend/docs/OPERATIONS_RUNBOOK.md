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

## VSDC operations (single-facility pilot)

- Use `GET /api/pharmacy/reports/fiscal-queue/:facilityId` to monitor retry backlog and dead-letter records.
- Retry queue health targets:
  - `processing` should return to 0 between scheduler windows.
  - `retryable` should trend down within 1 hour.
  - `dead_letter` must be triaged the same business day.
- Common API response code handling:
  - `881/882/883/884`: data quality issue (purchase code/TIN). Correct source sale data before replay.
  - `894/999`: connectivity/system issue. Keep queue active and verify endpoint and internet path.
  - `901/902/903`: device registration/activation issue. Re-run device initialization with RRA.
- Internet outage safety:
  - If internet outage exceeds 24h, suspend new fiscal receipt issuance and notify compliance lead.
  - Keep local sales operational only under approved business continuity SOP; replay queue once link is restored.
- Receipt verification checklist (daily):
  - `receipt_label` and `receipt_type_counter/receipt_global_counter` present.
  - `vsdc_internal_data`, `vsdc_receipt_signature`, and `vsdc_sdc_id` present on signed receipts.
  - Non-official receipts (`COPY`, `TRAINING`, `PROFORMA`) carry “THIS IS NOT AN OFFICIAL RECEIPT”.

## VSDC pilot readiness (go-live checklist)

Use this for a **single-facility** pilot before turning on live signing.

1. **Database**
   - Run migrations so `VsdcReadinessHardening1774800000000` is applied (`yarn migration:run` in the target environment).
   - Confirm `sales.vsdc_sdc_id`, `sale_items.tax_category`, and table `fiscal_receipt_counters` exist (or run `yarn vsdc-pilot-smoke`).

2. **Facility record**
   - Set `tin_number`, `ebm_device_serial`, and `ebm_sdcid` on the pilot facility to match RRA registration.
   - Set `ebm_enabled` to `true` only when you intend fiscal submission for that site.

3. **Tenant settings**
   - Set fiscal integration provider to `rra_vsdc` (and endpoint URL / credentials per environment) via existing pharmacy settings for that organization or facility, consistent with `settings-definition.seed.ts`.

4. **Application environment**
   - `RRA_EBM_BASE_URL` — VSDC/EBM base URL (test vs production per RRA).
   - `RRA_EBM_ENABLED` — `false` for **dry-run** (stub reference, no HTTP); `true` for **signed** submissions.
   - `RRA_EBM_API_KEY`, `RRA_EBM_DEVICE_SERIAL` — as issued for the device/environment.
   - Optional tuning: `RRA_EBM_MAX_ATTEMPTS`, `RRA_EBM_RETRY_BASE_MS`, `RRA_EBM_RETRY_MAX_MS`, `RRA_EBM_QUEUE_CLAIM_TTL_SECONDS`, `RRA_EBM_QUEUE_BATCH_SIZE`.

5. **Dry-run vs signed**
   - **Dry-run:** `RRA_EBM_ENABLED=false`, complete a test sale and refund; verify PDF/receipt layout and queue stays healthy (no outbound VSDC calls).
   - **Signed:** `RRA_EBM_ENABLED=true`, repeat with RRA-approved test data; verify `vsdc_internal_data`, `vsdc_receipt_signature`, counters, and `GET /api/pharmacy/reports/fiscal-queue/:facilityId`.

6. **Smoke verification**
   - From `Backend/`: `PILOT_FACILITY_ID=<id> yarn vsdc-pilot-smoke`
   - Optional API check (server running): set `SMOKE_API_BASE_URL` (e.g. `http://localhost:3000`) and `SMOKE_JWT` (Bearer token for a user with fiscal-queue access); the script calls the fiscal-queue report for the pilot facility.
