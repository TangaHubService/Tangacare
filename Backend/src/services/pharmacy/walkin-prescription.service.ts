import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { Prescription } from '../../entities/Prescription.entity';
import { CreateWalkInPrescriptionDto } from '../../dto/pharmacy.dto';

export class WalkInPrescriptionService {
    private repo: Repository<Prescription>;

    constructor() {
        this.repo = AppDataSource.getRepository(Prescription);
    }

    async createWalkIn(dto: CreateWalkInPrescriptionDto, createdByOrgUserId?: number): Promise<Prescription> {
        void createdByOrgUserId;
        const row = this.repo.create({
            organization_id: dto.organization_id,
            facility_id: dto.facility_id,
            prescription_text: dto.prescription_text,
            diagnosis: dto.diagnosis,
            walk_in_patient_name: dto.walk_in_patient_name,
            walk_in_patient_identifier: dto.walk_in_patient_identifier,
            external_prescriber_name: dto.external_prescriber_name,
            external_prescriber_license: dto.external_prescriber_license,
            validity_days: dto.validity_days,
            is_digital: false,
        });
        return await this.repo.save(row);
    }
}
