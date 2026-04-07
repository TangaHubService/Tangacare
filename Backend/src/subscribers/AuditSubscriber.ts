import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { AuditLog, AuditAction, AuditEntityType } from '../entities/AuditLog.entity';
import { Medicine } from '../entities/Medicine.entity';
import { Stock } from '../entities/Stock.entity';
import { Facility } from '../entities/Facility.entity';

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
    /**
     * Called after entity insertion.
     */
    async afterInsert(event: InsertEvent<any>) {
        await this.logAction(event, AuditAction.CREATE);
    }

    /**
     * Called after entity update.
     */
    async afterUpdate(event: UpdateEvent<any>) {
        await this.logAction(event, AuditAction.UPDATE);
    }

    /**
     * Called after entity removal.
     */
    async afterRemove(event: RemoveEvent<any>) {
        await this.logAction(event, AuditAction.DELETE);
    }

    private async logAction(event: InsertEvent<any> | UpdateEvent<any> | RemoveEvent<any>, action: AuditAction) {
        const entity = event.entity;
        if (!entity) return;

        const entityType = this.getEntityType(event.metadata.target);
        if (!entityType) return;

        // Skip internal audit logs to prevent infinite loops
        if (event.metadata.target === AuditLog) return;

        const auditLog = new AuditLog();
        auditLog.action = action;
        auditLog.entity_type = entityType;
        auditLog.entity_id = entity.id;
        auditLog.created_at = new Date();

        // Handle specific metadata if available (optional)
        // Note: In a real system, we'd pull userId from a request context handler

        if (action === AuditAction.UPDATE && 'databaseEntity' in event) {
            auditLog.old_values = event.databaseEntity;
            auditLog.new_values = entity;
        } else if (action === AuditAction.CREATE) {
            auditLog.new_values = entity;
        }

        try {
            await event.manager.getRepository(AuditLog).save(auditLog);
        } catch (error) {
            console.error('Error saving audit log in subscriber:', error);
        }
    }

    private getEntityType(target: any): AuditEntityType | null {
        if (target === Medicine) return AuditEntityType.MEDICINE;
        if (target === Stock) return AuditEntityType.STOCK;
        if (target === Facility) return AuditEntityType.FACILITY;
        // Add more as needed
        return null;
    }
}
