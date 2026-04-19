# Market readiness requirement matrix

Maps the pharmacy smart-inventory checklist to Tangacare artifacts. Status: **Implemented** | **Partial** | **Missing**. Owner = engineering squad; tests reference `Backend/src/__tests__` or noted path.

| Requirement | API / entity / UI | Status | Test / evidence | Owner |
| --- | --- | --- | --- | --- |
| Inventory ledger | `StockMovement`, `StockService.recordMovement` | Implemented | `stock.service` tests | BE |
| Batch / expiry / FEFO | `Batch`, `SaleService`, `StockService.getStockByLocation` | Implemented | `sale.service.test.ts` | BE |
| Expiry block dispense | `DispensingService`, `SaleService` | Implemented | dispensing tests | BE |
| Receiving / GR | `GoodsReceipt`, `ProcurementService.receiveOrder` | Implemented | `procurement.service.test.ts` | BE |
| QC / variance / COA / storage on receipt | GR items + procurement flags (`last_goods_receipt_id`, line QC/variance) | Implemented | migration `1774500000000` + `receiveOrder` | BE |
| Stock status (saleable / quarantine / non-saleable) | `stocks.stock_status`, services | Implemented | `stock.service` tests | BE |
| Recall + quarantine | `BatchRecall`, `RecallService`, `stock_status` | Implemented | recall flow manual + sale blocks | BE |
| Recall class I/II/III + SLA | `batch_recalls.recall_class`, `regulatory_due_at` | Implemented | `market-readiness.compliance.test` | BE |
| Rx-only (drug_schedule) | `SaleService` + walk-in `POST /walk-in-prescriptions` | Implemented | sale mocks include `drug_schedule` | BE |
| Controlled register export | `GET /reports/controlled-medicine-register/export` | Implemented | CSV from reporting controller | BE |
| Supplier qualification | `suppliers` + PO guard + UI modal | Implemented | procurement create + FE form | BE/FE |
| Complaints / CAPA / ADR | `QualityCase` + `/quality-cases` + UI | Implemented | manual / future API tests | BE/FE |
| Alerts + OOB delivery | `GET /alerts/delivery-logs` + notification audit | Implemented | ops runbook + service header | BE |
| RBAC server-side | `auth.middleware`, `permissions.ts`, `RBAC.md` | Implemented | `auth.middleware.test.ts` | BE |
| Audit log | `AuditLog`, UI | Implemented | audit read tests | BE |
| Immutability stock movements | `StockMovementImmutabilitySubscriber` + `StockService.recordMovement` insert-only | Implemented | subscriber + stock service | BE |
| MFA / backup / DR | `docs/OPERATIONS_RUNBOOK.md` | Partial | ops runbook | Ops |
| Codex / review gate | `.github/pull_request_template.md`, `docs/ASVS_REVIEW_CHECKLIST.md` | Partial | process | Eng |

## Pilot sign-off gate

Before go-live: pharmacist UAT (`docs/PHARMACIST_UAT_SIGNOFF.md`), successful restore drill (runbook), zero Sev-1 defects, recall drill with class SLA fields populated.
