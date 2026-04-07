# Purchase order workflows

This document complements `PurchaseOrderStatus` in `src/entities/PurchaseOrder.entity.ts` and the transition logic in `ProcurementService`.

## 1. Hospital / internal procurement (classic)

Typical path:

1. **draft** — PO created, lines editable.
2. **submitted** (or legacy **pending**) — sent for internal approval / supplier visibility depending on configuration.
3. **approved** (legacy) / **accepted** — approved internally or supplier terms accepted.
4. **received** / **partially_received** — goods receipt posted against the PO.
5. **cancelled** — terminal.

`approveOrder` in services is aligned with **legacy** flows where only **pending → approved** is allowed in one step. Newer quote-driven statuses use **submit → quote → review → accept** instead.

## 2. Supplier quote / portal path

1. **submitted** — buyer sends PO to supplier channel.
2. **quoted** / **partially_quoted** — supplier responds with prices or alternates.
3. **accepted** / **partially_accepted** / **rejected** — buyer reviews quotation (`reviewQuotation`).
4. Then receipt states as above.

## 3. Enterprise extensions (schema)

- **`medicine_facility_settings`** — per-facility overrides (e.g. `selling_price_override`) for chain formulary behavior. See migration `AddMedicineFacilitySellingOverrideAndPoThresholds`.
- **`purchase_approval_thresholds`** — org- or facility-level amount above which **dual approval** is expected (product policy; enforce in `ProcurementService` when you wire rules).

## 4. API stability

External clients should treat status as an **opaque string** until a formal state machine API (allowed transitions per role) is published. Prefer calling documented `ProcurementService` operations rather than PATCHing `status` directly.
