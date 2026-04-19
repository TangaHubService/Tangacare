import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { QualityCase, QualityCaseStatus } from '../../entities/QualityCase.entity';
import { CreateQualityCaseDto, UpdateQualityCaseDto } from '../../dto/pharmacy.dto';

export class QualityCaseService {
    private repo: Repository<QualityCase>;

    constructor() {
        this.repo = AppDataSource.getRepository(QualityCase);
    }

    async create(dto: CreateQualityCaseDto, organizationId: number, userId: number): Promise<QualityCase> {
        const row = this.repo.create({
            organization_id: organizationId,
            facility_id: dto.facility_id,
            type: dto.type,
            title: dto.title,
            description: dto.description,
            medicine_id: dto.medicine_id ?? null,
            batch_id: dto.batch_id ?? null,
            capa_actions: dto.capa_actions ?? null,
            created_by_id: userId,
        });
        return await this.repo.save(row);
    }

    async list(
        organizationId: number,
        facilityId?: number,
        page: number = 1,
        limit: number = 50,
    ): Promise<{ data: QualityCase[]; total: number; page: number; limit: number }> {
        const qb = this.repo
            .createQueryBuilder('q')
            .where('q.organization_id = :organizationId', { organizationId })
            .orderBy('q.reported_at', 'DESC');

        if (facilityId) {
            qb.andWhere('q.facility_id = :facilityId', { facilityId });
        }

        const [data, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
        return { data, total, page, limit };
    }

    async update(
        id: number,
        organizationId: number,
        dto: UpdateQualityCaseDto,
        userId: number,
    ): Promise<QualityCase> {
        const row = await this.repo.findOne({ where: { id, organization_id: organizationId } });
        if (!row) {
            throw new AppError('Quality case not found', 404);
        }
        if (dto.status !== undefined) {
            row.status = dto.status;
            if (dto.status === QualityCaseStatus.CLOSED) {
                row.closed_at = new Date();
            }
        }
        if (dto.capa_actions !== undefined) {
            row.capa_actions = dto.capa_actions;
        }
        row.updated_by_id = userId;
        return await this.repo.save(row);
    }
}
