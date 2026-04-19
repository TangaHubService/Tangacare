# Pharmacist UAT sign-off (pilot gate)

**Site:** ______________________ **Date:** ______________________  
**Responsible pharmacist / supervisor:** ______________________

Complete each scenario; initial when passed. Attach evidence (screenshots or register exports) where noted.

| # | Scenario | Pass |
| --- | --- | --- |
| 1 | Receive PO line with batch/expiry; goods receipt visible; stock increases. | |
| 2 | Receive with `qc_pass: false` → stock line in **quarantine**; cannot sell until resolved. | |
| 3 | Customer return (resellable) approved → stock **pending QC**; `POST /pharmacy/stock/release-qc` returns to **saleable**. | |
| 4 | FEFO: two batches same medicine; system blocks picking later expiry first (or override with reason + permission). | |
| 5 | Expired batch cannot complete sale. | |
| 6 | **Prescription-only** medicine blocks sale without prescription when setting enabled. | |
| 7 | Controlled medicine blocks without prescription / patient ID per settings. | |
| 8 | Initiate recall → affected batch **quarantine**; sale blocked; CSV export `GET .../reports/controlled-medicine-register/export`. | |
| 9 | Recall cancel → stock returns **saleable** (where appropriate). | |
| 10 | Quality case: log complaint/ADR; export or print for binder. | |

**Sign-off:** I confirm the above was executed on live or pilot data and is acceptable for go-live.

Signature: ______________________  Date: ______________________
