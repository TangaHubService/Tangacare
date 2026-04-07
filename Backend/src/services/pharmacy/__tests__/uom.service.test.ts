import { UomService } from '../uom.service';
import { Medicine } from '../../../entities/Medicine.entity';

describe('UomService', () => {
    const mockMedicine = {
        units_per_package: 10,
    } as Medicine;

    describe('toBaseUnits', () => {
        it('should correctly convert purchase units to base units', () => {
            expect(UomService.toBaseUnits(5, mockMedicine)).toBe(50);
        });

        it('should return same quantity if units_per_package is 1', () => {
            const med = { units_per_package: 1 } as Medicine;
            expect(UomService.toBaseUnits(5, med)).toBe(5);
        });
    });

    describe('toBaseUnitCost', () => {
        it('should correctly convert purchase unit cost to base unit cost', () => {
            expect(UomService.toBaseUnitCost(100, mockMedicine)).toBe(10);
        });
    });

    describe('toPurchaseUnits', () => {
        it('should correctly convert base units to purchase units', () => {
            expect(UomService.toPurchaseUnits(50, mockMedicine)).toBe(5);
        });
    });
});
