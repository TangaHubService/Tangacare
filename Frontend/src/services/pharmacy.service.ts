import { medicineService } from './medicine.service';
import { saleService } from './sale.service';
import { inventoryService } from './inventory.service';
import { procurementService } from './procurement.service';
import { reportService } from './report.service';
import { facilityService } from './facility.service';
import { patientService } from './patient.service';
import { insuranceService } from './insurance.service';
import { dashboardSearchService } from './dashboard-search.service';

/**
 * Pharmacy Service Facade
 *
 * This service acts as a single entry point for all pharmacy-related API calls,
 * delegating to specialized modular services while maintaining backward compatibility.
 */
export const pharmacyService = {
    // Medicine Service
    ...medicineService,

    // Sale Service
    ...saleService,

    // Inventory Service
    ...inventoryService,

    // Procurement Service
    ...procurementService,

    // Report & Analytics Service
    ...reportService,

    // Facility & Organization Service
    ...facilityService,

    // Patient Service
    ...patientService,

    // Insurance Service
    ...insuranceService,

    ...dashboardSearchService,
};

export default pharmacyService;
