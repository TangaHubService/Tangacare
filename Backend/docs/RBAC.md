# Role-based access control (Tangacare backend)

## Two mechanisms

1. **`authorize(...roles)`** in [`src/middleware/auth.middleware.ts`](../src/middleware/auth.middleware.ts)  
   - Allows access if the JWT user’s `role` is listed **or** the user is **`OWNER`**.  
   - **`OWNER` bypass:** `OWNER` is always admitted, even when not included in `allowedRoles`. This is intentional for organization owners managing their tenant.  
   - **`SUPER_ADMIN`** is **not** special-cased here: it must appear in `allowedRoles` when using `authorize`.

2. **`requirePermission(...permissions)`** in the same file  
   - Allows access if the user’s role has **any** of the listed permissions (see [`src/config/permissions.ts`](../src/config/permissions.ts)) **or** the user is **`OWNER`**.  
   - **`OWNER` bypass:** `OWNER` is admitted without checking the permission list (same pattern as `authorize`).  
   - **`SUPER_ADMIN`** is **not** bypassed by `isOwner`; it must have the relevant permission in `ROLE_PERMISSIONS` (it does for pharmacy operations).

## Pharmacy sales / dispensing

`POST /api/pharmacy/sales` and `POST /api/pharmacy/dispensing` use **`requirePermission(PERMISSIONS.DISPENSING_WRITE)`** so behavior matches the permission matrix (e.g. cashier, technician, pharmacist). Listing sales uses **`requirePermission(PERMISSIONS.DISPENSING_READ)`**.

## Frontend parity

The SPA should mirror the same rules using `can(permission)` from the auth context and [`Frontend/src/lib/rolePermissions.ts`](../../Frontend/src/lib/rolePermissions.ts) defaults when the API omits `permissions` on the user payload.
