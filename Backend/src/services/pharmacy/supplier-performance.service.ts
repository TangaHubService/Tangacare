import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { PurchaseOrder } from '../../entities/PurchaseOrder.entity';

/** Row shape returned by GET /pharmacy/analytics/supplier-performance */
export interface SupplierPerformanceAnalyticsRow {
    supplier_id: number;
    supplier_name: string;
    total_orders: number;
    avg_lead_time_days: number;
    fulfillment_rate: number;
    on_time_delivery_rate: number;
}

/**
 * Single implementation for supplier performance metrics (procurement-based).
 * Used by analytics and reporting layers to avoid duplicate logic.
 */
export class SupplierPerformanceService {
    private purchaseOrderRepository: Repository<PurchaseOrder>;

    constructor() {
        this.purchaseOrderRepository = AppDataSource.getRepository(PurchaseOrder);
    }

    /**
     * Organization-scoped metrics, optionally filtered to one facility.
     */
    async getAggregatedForOrganization(
        facilityId: number | undefined,
        organizationId: number,
    ): Promise<SupplierPerformanceAnalyticsRow[]> {
        const poQuery = this.purchaseOrderRepository
            .createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .leftJoinAndSelect('po.items', 'items')
            .where('po.organization_id = :organizationId', { organizationId });

        if (facilityId) {
            poQuery.andWhere('po.facility_id = :facilityId', { facilityId });
        }

        const orders = await poQuery.getMany();

        const supplierStats = new Map<
            number,
            {
                supplier_name: string;
                orders: PurchaseOrder[];
            }
        >();

        orders.forEach((order) => {
            const existing = supplierStats.get(order.supplier_id) || {
                supplier_name: order.supplier?.name || 'Unknown',
                orders: [],
            };
            existing.orders.push(order);
            supplierStats.set(order.supplier_id, existing);
        });

        const metrics = Array.from(supplierStats.entries()).map(([supplierId, data]) => {
            let totalLeadTime = 0;
            let leadTimeCount = 0;
            let onTimeDeliveries = 0;
            let totalOrdered = 0;
            let totalReceived = 0;

            data.orders.forEach((order) => {
                if (order.received_date && order.order_date) {
                    const leadTime =
                        (new Date(order.received_date).getTime() - new Date(order.order_date).getTime()) /
                        (24 * 60 * 60 * 1000);
                    totalLeadTime += Math.max(0, leadTime);
                    leadTimeCount += 1;

                    if (order.expected_delivery_date) {
                        if (new Date(order.received_date) <= new Date(order.expected_delivery_date)) {
                            onTimeDeliveries += 1;
                        }
                    } else if (leadTime <= 7) {
                        onTimeDeliveries += 1;
                    }
                }

                order.items?.forEach((item) => {
                    totalOrdered += Number(item.quantity_ordered || 0);
                    totalReceived += Number(item.quantity_received || 0);
                });
            });

            return {
                supplier_id: supplierId,
                supplier_name: data.supplier_name,
                total_orders: data.orders.length,
                avg_lead_time_days: leadTimeCount > 0 ? Math.round((totalLeadTime / leadTimeCount) * 10) / 10 : 0,
                fulfillment_rate: totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 1000) / 10 : 0,
                on_time_delivery_rate:
                    leadTimeCount > 0 ? Math.round((onTimeDeliveries / leadTimeCount) * 1000) / 10 : 0,
            };
        });

        return metrics.sort((a, b) => b.total_orders - a.total_orders);
    }
}
