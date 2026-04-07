import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Medicine, DrugSchedule } from '../../entities/Medicine.entity';
import { DispenseTransaction } from '../../entities/DispenseTransaction.entity';

export interface SafetyCheckResult {
    is_safe: boolean;
    warnings: string[];
    errors: string[];
    suggested_alternatives?: Array<{ id: number; name: string; reason: string }>;
}

export class SafetyService {
    private medicineRepository: Repository<Medicine>;
    private dispenseRepository: Repository<DispenseTransaction>;

    constructor() {
        this.medicineRepository = AppDataSource.getRepository(Medicine);
        this.dispenseRepository = AppDataSource.getRepository(DispenseTransaction);
    }

    /**
     * Perform clinical safety checks for a drug dispensing request
     */
    async performSafetyCheck(
        facilityId: number,
        organizationId: number,
        medicineId: number,
        quantity: number,
        patientId?: number,
        prescriptionId?: number,
    ): Promise<SafetyCheckResult> {
        void facilityId;
        const medicine = await this.medicineRepository.findOne({
            where: { id: medicineId, organization_id: organizationId },
        });
        const result: SafetyCheckResult = { is_safe: true, warnings: [], errors: [] };

        if (!medicine) {
            result.is_safe = false;
            result.errors.push('Medicine not found');
            return result;
        }

        // 1. Controlled Substance Check
        if (
            medicine.is_controlled_drug ||
            [
                DrugSchedule.CONTROLLED_SUBSTANCE_SCH_II,
                DrugSchedule.CONTROLLED_SUBSTANCE_SCH_III,
                DrugSchedule.CONTROLLED_SUBSTANCE_SCH_IV,
            ].includes(medicine.drug_schedule)
        ) {
            if (!prescriptionId) {
                result.is_safe = false;
                result.errors.push(`Prescription is mandatory for controlled drug: ${medicine.name}`);
            }
            if (!patientId) {
                result.warnings.push('Patient registration is highly recommended for controlled substances');
            }
        }

        // 2. Frequency Check (Duplicate Therapy / Over-dispensing)
        if (patientId) {
            const lastDispensed = await this.dispenseRepository.findOne({
                where: {
                    patient_id: patientId,
                    medicine_id: medicineId,
                    organization_id: organizationId,
                },
                order: { created_at: 'DESC' },
            });

            if (lastDispensed) {
                const daysSinceLast =
                    (new Date().getTime() - new Date(lastDispensed.created_at).getTime()) / (1000 * 3600 * 24);
                if (daysSinceLast < 7) {
                    result.warnings.push(
                        `This medicine was last dispensed to this patient ${Math.round(daysSinceLast)} days ago.`,
                    );
                }
            }
        }

        // 3. Stock Level Suggestions
        // If low, suggest alternatives of same dosage form? (Simple logic for now)
        if (quantity > 100) {
            result.warnings.push('Large quantity dispensing detected. Please verify dosage instructions.');
        }

        result.is_safe = result.errors.length === 0;
        return result;
    }

    /**
     * Get medicine recommendations based on safety and availability
     */
    async getSmartRecommendations(facilityId: number, organizationId: number, medicineId: number): Promise<any[]> {
        const medicine = await this.medicineRepository.findOne({
            where: { id: medicineId, organization_id: organizationId },
        });
        if (!medicine) return [];

        // Find medicines in same category with higher stock
        return await this.medicineRepository
            .createQueryBuilder('medicine')
            .leftJoin('stocks', 'stock', 'stock.medicine_id = medicine.id AND stock.facility_id = :facilityId', {
                facilityId,
            })
            .where('medicine.category_id = :categoryId', { categoryId: medicine.category_id })
            .andWhere('medicine.id != :medicineId', { medicineId })
            .andWhere('medicine.organization_id = :organizationId', { organizationId })
            .andWhere('medicine.is_active = :isActive', { isActive: true })
            .select(['medicine.id', 'medicine.name', 'medicine.selling_price'])
            .addSelect('SUM(COALESCE(stock.quantity, 0))', 'total_stock')
            .groupBy('medicine.id')
            .having('SUM(COALESCE(stock.quantity, 0)) > 0')
            .orderBy('total_stock', 'DESC')
            .limit(3)
            .getRawMany();
    }
}
