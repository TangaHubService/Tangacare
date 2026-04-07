import { Medicine } from '../../entities/Medicine.entity';

export class UomService {
    /**
     * Converts a quantity from purchase units (e.g. Boxes) to base units (e.g. Tablets).
     */
    static toBaseUnits(qty: number, medicine: Medicine | null | undefined): number {
        const factor = medicine?.units_per_package || 1;
        return qty * factor;
    }

    /**
     * Converts a unit cost from purchase units to base units.
     */
    static toBaseUnitCost(unitCost: number, medicine: Medicine | null | undefined): number {
        const factor = medicine?.units_per_package || 1;
        return unitCost / factor;
    }

    /**
     * Converts a quantity from base units to purchase units (for display/reporting).
     */
    static toPurchaseUnits(qty: number, medicine: Medicine | null | undefined): number {
        const factor = medicine?.units_per_package || 1;
        return qty / factor;
    }
}
