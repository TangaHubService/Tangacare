import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Medicine } from '../../entities/Medicine.entity';
import { Stock } from '../../entities/Stock.entity';
import { Batch } from '../../entities/Batch.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';
import { MedicineFacilitySetting } from '../../entities/MedicineFacilitySetting.entity';
import { FacilityMedicineConfig } from '../../entities/FacilityMedicineConfig.entity';
import { PurchasePriceHistory } from '../../entities/PurchasePriceHistory.entity';

export type ReplenishmentUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface ReplenishmentSuggestion {
    medicine_id: number;
    medicine_name: string;
    current_quantity: number;
    usable_stock: number;
    at_risk_expiry_qty: number;
    min_stock_level: number;
    reorder_point: number;
    target_stock_level: number;
    avg_daily_consumption: number;
    lead_time_days: number;
    safety_stock_quantity: number;
    suggested_quantity: number;
    deficit_quantity: number;
    days_remaining: number;
    days_of_cover: number;
    urgency: ReplenishmentUrgency;
    recommended_action: string;
    preferred_supplier_id?: number;
}

/**
 * Canonical replenishment logic shared by analytics, procurement automation and schedulers.
 */
export class ReplenishmentService {
    private medicineRepository: Repository<Medicine>;
    private stockRepository: Repository<Stock>;
    private dispenseRepository: Repository<DispenseTransaction>;
    private medicineFacilitySettingRepository: Repository<MedicineFacilitySetting>;
    private facilityMedicineConfigRepository: Repository<FacilityMedicineConfig>;
    private purchasePriceHistoryRepository: Repository<PurchasePriceHistory>;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
        this.medicineFacilitySettingRepository = AppDataSource.getRepository(MedicineFacilitySetting);
        this.facilityMedicineConfigRepository = AppDataSource.getRepository(FacilityMedicineConfig);
        this.purchasePriceHistoryRepository = AppDataSource.getRepository(PurchasePriceHistory);
    }

    async getSuggestions(organizationId: number, facilityId?: number): Promise<ReplenishmentSuggestion[]> {
        const medicines = await this.medicineRepository.find({
            where: { is_active: true, organization_id: organizationId },
        });
        if (medicines.length === 0) return [];

        const medicineIds = medicines.map((m) => m.id);

        const stockQb = this.stockRepository
            .createQueryBuilder('stock')
            .select('stock.medicine_id', 'medicine_id')
            .addSelect('COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0)', 'available_qty')
            .addSelect(
                `COALESCE(SUM(CASE WHEN batch.expiry_date <= :nearExpiryDate THEN (stock.quantity - stock.reserved_quantity) ELSE 0 END), 0)`,
                'near_expiry_qty',
            )
            .leftJoin(Batch, 'batch', 'batch.id = stock.batch_id')
            .where('stock.organization_id = :organizationId', { organizationId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .andWhere('stock.medicine_id IN (:...medicineIds)', { medicineIds })
            .groupBy('stock.medicine_id')
            .setParameter('nearExpiryDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

        if (facilityId) {
            stockQb.andWhere('stock.facility_id = :facilityId', { facilityId });
        }

        const stockRows = await stockQb.getRawMany();
        const stockByMedicine = new Map<
            number,
            {
                available: number;
                nearExpiry: number;
            }
        >();
        stockRows.forEach((row) => {
            stockByMedicine.set(Number(row.medicine_id), {
                available: Math.max(0, Number(row.available_qty || 0)),
                nearExpiry: Math.max(0, Number(row.near_expiry_qty || 0)),
            });
        });

        const settingsByMedicine = new Map<number, MedicineFacilitySetting>();
        const configByMedicine = new Map<number, FacilityMedicineConfig>();
        if (facilityId) {
            const [settings, configs] = await Promise.all([
                this.medicineFacilitySettingRepository.find({
                    where: { facility_id: facilityId },
                }),
                this.facilityMedicineConfigRepository.find({
                    where: { facility_id: facilityId, organization_id: organizationId },
                }),
            ]);
            settings.forEach((s) => settingsByMedicine.set(s.medicine_id, s));
            configs.forEach((c) => configByMedicine.set(c.medicine_id, c));
        }

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const dispenseQb = this.dispenseRepository
            .createQueryBuilder('dt')
            .select('dt.medicine_id', 'medicine_id')
            .addSelect('COALESCE(SUM(dt.quantity), 0)', 'dispensed')
            .where('dt.organization_id = :organizationId', { organizationId })
            .andWhere('dt.created_at >= :startDate', { startDate: ninetyDaysAgo })
            .andWhere('dt.medicine_id IN (:...medicineIds)', { medicineIds })
            .groupBy('dt.medicine_id');
        if (facilityId) {
            dispenseQb.andWhere('dt.facility_id = :facilityId', { facilityId });
        }
        const dispenseRows = await dispenseQb.getRawMany();
        const dispensedByMedicine = new Map<number, number>();
        dispenseRows.forEach((row) => {
            dispensedByMedicine.set(Number(row.medicine_id), Number(row.dispensed || 0));
        });

        const preferredSupplierRows = await this.purchasePriceHistoryRepository
            .createQueryBuilder('pph')
            .select('pph.medicine_id', 'medicine_id')
            .addSelect('pph.supplier_id', 'supplier_id')
            .addSelect('MAX(pph.created_at)', 'last_at')
            .where('pph.organization_id = :organizationId', { organizationId })
            .andWhere('pph.medicine_id IN (:...medicineIds)', { medicineIds })
            .groupBy('pph.medicine_id')
            .addGroupBy('pph.supplier_id')
            .getRawMany();
        const preferredSupplierByMedicine = new Map<number, number>();
        preferredSupplierRows.forEach((row) => {
            const medicineId = Number(row.medicine_id);
            const supplierId = Number(row.supplier_id);
            const ts = new Date(row.last_at).getTime();
            const existing = preferredSupplierByMedicine.get(medicineId);
            if (!existing) {
                preferredSupplierByMedicine.set(medicineId, supplierId);
                return;
            }
            const existingRow = preferredSupplierRows.find(
                (r) =>
                    Number(r.medicine_id) === medicineId &&
                    Number(r.supplier_id) === existing,
            );
            const existingTs = existingRow ? new Date(existingRow.last_at).getTime() : 0;
            if (ts > existingTs) {
                preferredSupplierByMedicine.set(medicineId, supplierId);
            }
        });

        const suggestions: ReplenishmentSuggestion[] = [];
        medicines.forEach((medicine) => {
                const stock = stockByMedicine.get(medicine.id) || { available: 0, nearExpiry: 0 };
                const setting = settingsByMedicine.get(medicine.id);
                const config = configByMedicine.get(medicine.id);

                const minStockLevel =
                    Number(setting?.min_stock_level ?? config?.min_stock_level ?? medicine.min_stock_level ?? 0) || 0;
                const leadTimeDays = Math.max(1, Number(medicine.lead_time_days || 7));
                const avgDailyConsumption =
                    Number(medicine.avg_daily_consumption || 0) > 0
                        ? Number(medicine.avg_daily_consumption)
                        : (Number(dispensedByMedicine.get(medicine.id) || 0) / 90) || 0;
                const safetyStockQuantity = Math.max(
                    0,
                    Number(
                        medicine.safety_stock_quantity ||
                            Math.ceil(avgDailyConsumption * Math.max(1, leadTimeDays * 0.5)),
                    ),
                );

                const computedReorderPoint = Math.ceil(leadTimeDays * avgDailyConsumption + safetyStockQuantity);
                const reorderPoint = Math.max(
                    minStockLevel,
                    Number(setting?.reorder_point ?? medicine.reorder_point ?? computedReorderPoint ?? 0),
                );

                const computedTarget = Math.max(
                    reorderPoint,
                    Math.ceil(avgDailyConsumption * Math.max(14, leadTimeDays * 2) + safetyStockQuantity),
                );
                const targetStockLevel = Math.max(
                    reorderPoint,
                    Number(setting?.target_stock_level ?? config?.target_stock_level ?? medicine.target_stock_level ?? computedTarget),
                );

                const currentQuantity = Math.max(0, stock.available);
                const atRiskExpiryQty = Math.min(currentQuantity, Math.max(0, stock.nearExpiry));
                const usableStock = Math.max(0, currentQuantity - atRiskExpiryQty);

                if (reorderPoint <= 0 || targetStockLevel <= 0 || usableStock > reorderPoint) {
                    return;
                }

                const suggestedQuantity = Math.max(0, targetStockLevel - usableStock);
                if (suggestedQuantity <= 0) return;

                const daysRemaining =
                    avgDailyConsumption > 0 ? usableStock / avgDailyConsumption : usableStock === 0 ? 0 : 999;
                let urgency: ReplenishmentUrgency = 'low';
                if (usableStock <= 0 || daysRemaining <= 2) urgency = 'critical';
                else if (daysRemaining <= 5 || usableStock <= minStockLevel) urgency = 'high';
                else if (daysRemaining <= 10 || usableStock <= reorderPoint) urgency = 'medium';

                let recommendedAction = 'Include item in normal replenishment run.';
                if (urgency === 'critical') {
                    recommendedAction = 'Raise emergency reorder now and check inter-facility transfer immediately.';
                } else if (urgency === 'high') {
                    recommendedAction = 'Prioritize reorder within 24 hours and confirm supplier availability.';
                } else if (urgency === 'medium') {
                    recommendedAction = 'Create replenishment order in current cycle to avoid stockout.';
                }

                if (atRiskExpiryQty > 0) {
                    recommendedAction += ` Note: ${Math.round(atRiskExpiryQty)} units are near expiry and excluded from usable stock.`;
                }

                suggestions.push({
                    medicine_id: medicine.id,
                    medicine_name: medicine.name,
                    current_quantity: Math.round(currentQuantity * 100) / 100,
                    usable_stock: Math.round(usableStock * 100) / 100,
                    at_risk_expiry_qty: Math.round(atRiskExpiryQty * 100) / 100,
                    min_stock_level: Math.round(minStockLevel),
                    reorder_point: Math.round(reorderPoint),
                    target_stock_level: Math.round(targetStockLevel),
                    avg_daily_consumption: Math.round(avgDailyConsumption * 100) / 100,
                    lead_time_days: Math.round(leadTimeDays),
                    safety_stock_quantity: Math.round(safetyStockQuantity),
                    suggested_quantity: Math.ceil(suggestedQuantity),
                    deficit_quantity: Math.ceil(Math.max(0, reorderPoint - usableStock)),
                    days_remaining: Math.round(daysRemaining * 10) / 10,
                    days_of_cover: Math.round(daysRemaining * 10) / 10,
                    urgency,
                    recommended_action: recommendedAction,
                    preferred_supplier_id: preferredSupplierByMedicine.get(medicine.id),
                });
            });

        suggestions.sort((a, b) => {
            const urgencyOrder: Record<ReplenishmentUrgency, number> = {
                critical: 0,
                high: 1,
                medium: 2,
                low: 3,
            };
            const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
            if (urgencyDiff !== 0) return urgencyDiff;
            return b.suggested_quantity - a.suggested_quantity;
        });

        return suggestions;
    }
}
