import { Repository, EntityManager } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { InsuranceClaim, InsuranceClaimStatus } from '../../entities/InsuranceClaim.entity';
import { UpdateInsuranceClaimDto } from '../../dto/pharmacy.dto';
import { AppError } from '../../middleware/error.middleware';
import { AuditService } from './audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';
import { applyScope } from '../../utils/scope.util';
import { AuthRequest } from '../../middleware/auth.middleware';


export class InsuranceService {
    private claimRepository: Repository<InsuranceClaim>;
    private auditService: AuditService;

    constructor(entityManager?: EntityManager) {
        const source = entityManager || AppDataSource;
        this.claimRepository = source.getRepository(InsuranceClaim);
        this.auditService = new AuditService(source instanceof EntityManager ? source : source.manager);
    }

    async createClaim(data: Partial<InsuranceClaim>): Promise<InsuranceClaim> {
        const claim = this.claimRepository.create(data);
        return await this.claimRepository.save(claim);
    }

    async updateClaim(
        id: number,
        dto: UpdateInsuranceClaimDto,
        userId: number,
        facilityId: number,
    ): Promise<InsuranceClaim> {
        const claim = await this.claimRepository.findOne({
            where: { id },
            relations: ['sale'],
        });

        if (!claim) {
            throw new AppError('Insurance claim not found', 404);
        }

        const oldValues = { ...claim };

        if (dto.status) {
            claim.status = dto.status as InsuranceClaimStatus;
            if (dto.status === InsuranceClaimStatus.SUBMITTED && !claim.submitted_at) {
                claim.submitted_at = new Date();
            }
            if (
                [InsuranceClaimStatus.APPROVED, InsuranceClaimStatus.REJECTED, InsuranceClaimStatus.PAID].includes(
                    dto.status as InsuranceClaimStatus,
                )
            ) {
                claim.processed_at = new Date();
            }
        }

        if (dto.actual_received_amount !== undefined) {
            claim.actual_received_amount = dto.actual_received_amount;
        }

        if (dto.notes !== undefined) {
            claim.notes = dto.notes;
        }

        const savedClaim = await this.claimRepository.save(claim);

        // Audit Log
        await this.auditService.log({
            facility_id: facilityId,
            user_id: userId,
            action: AuditAction.UPDATE,
            entity_type: AuditEntityType.SALE, // Linking to sale for easier tracking
            entity_id: claim.sale_id,
            entity_name: `Insurance Claim for Sale #${claim.sale?.sale_number || claim.sale_id}`,
            description: `Insurance claim status updated from ${oldValues.status} to ${savedClaim.status}`,
            old_values: oldValues,
            new_values: savedClaim,
        });

        return savedClaim;
    }

    async findAll(
        filters: {
            status?: InsuranceClaimStatus;
            provider_id?: number;
            facility_id?: number;
            start_date?: string;
            end_date?: string;
        },
        req?: AuthRequest,
    ): Promise<InsuranceClaim[]> {

        const queryBuilder = this.claimRepository
            .createQueryBuilder('claim')
            .leftJoinAndSelect('claim.sale', 'sale')
            .leftJoinAndSelect('claim.provider', 'provider')
            .leftJoinAndSelect('sale.patient', 'patient');

        if (filters.status) {
            queryBuilder.andWhere('claim.status = :status', { status: filters.status });
        }

        if (filters.provider_id) {
            queryBuilder.andWhere('claim.provider_id = :provider_id', { provider_id: filters.provider_id });
        }

        if (req?.scope) {
            applyScope(queryBuilder, req.scope, { alias: 'sale' });
        } else if (filters.facility_id) {
            queryBuilder.andWhere('sale.facility_id = :facility_id', { facility_id: filters.facility_id });
        }


        if (filters.start_date) {
            queryBuilder.andWhere('claim.created_at >= :start_date', { start_date: filters.start_date });
        }

        if (filters.end_date) {
            const end = new Date(filters.end_date);
            end.setHours(23, 59, 59, 999);
            queryBuilder.andWhere('claim.created_at <= :end_date', { end_date: end });
        }

        return await queryBuilder.orderBy('claim.created_at', 'DESC').getMany();
    }
}
