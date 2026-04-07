import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { UserRole } from '../entities/User.entity';
import { AuditService } from '../services/pharmacy/audit.service';
import { AuditAction, AuditEntityType } from '../entities/AuditLog.entity';

const auditService = new AuditService();

function actionFromMethod(method: string): AuditAction {
    switch (method.toUpperCase()) {
        case 'GET':
        case 'HEAD':
            return AuditAction.VIEW;
        case 'POST':
            return AuditAction.CREATE;
        case 'PUT':
        case 'PATCH':
            return AuditAction.UPDATE;
        case 'DELETE':
            return AuditAction.DELETE;
        default:
            return AuditAction.VIEW;
    }
}

/**
 * Best-effort auditing for SUPER_ADMIN requests that operate within an effective organization scope.
 * This ensures cross-organization reads/writes are auditable even when using impersonation tokens.
 */
export const superAdminAuditMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();

    res.on('finish', () => {
        try {
            const user = (req as any).user as AuthRequest['user'] | undefined;
            if (!user || user.role !== UserRole.SUPER_ADMIN) return;

            // Skip explicit admin endpoints (they have dedicated audit logs).
            if (String(req.originalUrl || '').includes('/admin')) return;

            // Only audit successful requests.
            if (res.statusCode < 200 || res.statusCode >= 400) return;

            const url = String(req.originalUrl || '');
            const isTenantDataPath = url.includes('/pharmacy/') || url.includes('/users');
            if (!isTenantDataPath) return;

            const scope = (req as any).scope as { organizationId?: number } | undefined;
            const targetOrgId = scope?.organizationId ?? (user.organizationId as any);
            if (!targetOrgId) return;

            void auditService
                .log({
                    user_id: user.userId,
                    organization_id: targetOrgId,
                    action: actionFromMethod(req.method),
                    entity_type: AuditEntityType.ORGANIZATION,
                    entity_id: targetOrgId,
                    description: `SUPER_ADMIN ${req.method.toUpperCase()} ${url} -> ${res.statusCode}`,
                    new_values: {
                        duration_ms: Date.now() - startedAt,
                    },
                    ip_address: req.ip,
                    user_agent: String(req.headers['user-agent'] || ''),
                })
                .catch((err) => console.error('[SuperAdminAudit] Failed to persist audit log:', err));
        } catch (error) {
            console.error('[SuperAdminAudit] Unexpected error:', error);
        }
    });

    next();
};

