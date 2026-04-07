import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { PurchaseOrder } from '../../entities/PurchaseOrder.entity';
import { Batch } from '../../entities/Batch.entity';
import { MedicineService } from './medicine.service';
import { SupplierService } from './supplier.service';
import { AuditService } from './audit.service';

export interface PharmacyGlobalSearchHit {
    id: string;
    label: string;
    meta: string;
    /** UI route path without origin, e.g. /app/inventory/1 */
    to: string;
    group: 'medicines' | 'batches' | 'suppliers' | 'purchaseOrders' | 'stockMovements';
}

export interface PharmacyGlobalSearchResult {
    medicines: PharmacyGlobalSearchHit[];
    batches: PharmacyGlobalSearchHit[];
    suppliers: PharmacyGlobalSearchHit[];
    purchaseOrders: PharmacyGlobalSearchHit[];
    stockMovements: PharmacyGlobalSearchHit[];
}

/**
 * Single round-trip search across common pharmacy entities (header bar).
 */
export class PharmacyGlobalSearchService {
    private purchaseOrderRepository: Repository<PurchaseOrder>;
    private batchRepository: Repository<Batch>;
    private medicineService: MedicineService;
    private supplierService: SupplierService;
    private auditService: AuditService;

    constructor() {
        this.purchaseOrderRepository = AppDataSource.getRepository(PurchaseOrder);
        this.batchRepository = AppDataSource.getRepository(Batch);
        this.medicineService = new MedicineService();
        this.supplierService = new SupplierService();
        this.auditService = new AuditService();
    }

    async search(params: {
        organizationId: number;
        facilityId?: number;
        q: string;
        limitPerGroup?: number;
    }): Promise<PharmacyGlobalSearchResult> {
        const raw = (params.q || '').trim();
        if (raw.length < 2) {
            return {
                medicines: [],
                batches: [],
                suppliers: [],
                purchaseOrders: [],
                stockMovements: [],
            };
        }

        const lim = Math.min(Math.max(params.limitPerGroup ?? 5, 1), 20);

        const [medicinesPage, suppliersPage, purchaseOrders, batchRows, movementsPage] = await Promise.all([
            this.medicineService.findAll(
                1,
                lim,
                raw,
                undefined,
                undefined,
                undefined,
                params.facilityId,
                undefined,
                undefined,
                undefined,
                undefined,
                params.organizationId,
            ),
            this.supplierService.findAll(params.organizationId, params.facilityId, 1, lim, raw),
            this.searchPurchaseOrders(params.organizationId, params.facilityId, raw, lim),
            this.searchBatches(params.organizationId, params.facilityId, raw, lim),
            params.facilityId
                ? this.auditService.getStockMovements(
                      params.facilityId,
                      undefined,
                      undefined,
                      1,
                      lim,
                      params.organizationId,
                      raw,
                  )
                : Promise.resolve({ data: [], total: 0, page: 1, limit: lim }),
        ]);

        const medicines: PharmacyGlobalSearchHit[] = (medicinesPage.data || []).map((m: any) => ({
            id: String(m.id),
            label: String(m.name || 'Medicine'),
            meta: String(m.generic_name || m.code || m.category?.name || 'Medicine'),
            to: `/app/inventory/${m.id}`,
            group: 'medicines',
        }));

        const suppliers: PharmacyGlobalSearchHit[] = (suppliersPage.data || []).map((s: any) => ({
            id: String(s.id),
            label: String(s.name || 'Supplier'),
            meta: String(s.contact_person || s.phone || 'Supplier'),
            to: '/app/procurement/suppliers',
            group: 'suppliers',
        }));

        const purchaseOrderHits: PharmacyGlobalSearchHit[] = purchaseOrders.map((po) => ({
            id: String(po.id),
            label: String(po.order_number || `PO-${po.id}`),
            meta: String(po.supplier?.name || po.status || 'Purchase order'),
            to: `/app/procurement/orders/${po.id}`,
            group: 'purchaseOrders',
        }));

        const batches: PharmacyGlobalSearchHit[] = batchRows.map((b) => ({
            id: String(b.batch_number),
            label: String(b.batch_number),
            meta: String((b as any).medicine?.name || 'Batch'),
            to: '/app/stock',
            group: 'batches',
        }));

        const stockMovements: PharmacyGlobalSearchHit[] = (movementsPage.data || []).slice(0, lim).map((row) => ({
            id: String(row.id),
            label: String(row.entity_name || row.reference || 'Movement'),
            meta: String(row.description || row.movement_type || 'Stock movement'),
            to: '/app/stock-movements',
            group: 'stockMovements',
        }));

        return {
            medicines,
            batches,
            suppliers,
            purchaseOrders: purchaseOrderHits,
            stockMovements,
        };
    }

    private async searchBatches(
        organizationId: number,
        facilityId: number | undefined,
        q: string,
        limit: number,
    ): Promise<Batch[]> {
        const qb = this.batchRepository
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'medicine')
            .where('b.organization_id = :organizationId', { organizationId })
            .andWhere('(b.batch_number ILIKE :q OR medicine.name ILIKE :q)', { q: `%${q}%` })
            .orderBy('b.expiry_date', 'ASC')
            .take(limit);

        if (facilityId) {
            qb.andWhere('b.facility_id = :facilityId', { facilityId });
        }

        return qb.getMany();
    }

    private async searchPurchaseOrders(
        organizationId: number,
        facilityId: number | undefined,
        q: string,
        limit: number,
    ): Promise<PurchaseOrder[]> {
        const qb = this.purchaseOrderRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .where('po.organization_id = :organizationId', { organizationId })
            .andWhere('(po.order_number ILIKE :q OR supplier.name ILIKE :q)', { q: `%${q}%` })
            .orderBy('po.created_at', 'DESC')
            .take(limit);

        if (facilityId) {
            qb.andWhere('po.facility_id = :facilityId', { facilityId });
        }

        return qb.getMany();
    }
}
