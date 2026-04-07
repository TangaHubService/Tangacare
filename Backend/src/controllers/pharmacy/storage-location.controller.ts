import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { StorageLocation } from '../../entities/StorageLocation.entity';
import { AppError } from '../../middleware/error.middleware';
import { CreateStorageLocationDto, UpdateStorageLocationDto } from '../../dto/pharmacy.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

export class StorageLocationController {
    private repository: Repository<StorageLocation>;

    constructor() {
        this.repository = AppDataSource.getRepository(StorageLocation);
    }

    create = async (req: Request, res: Response) => {
        const facilityId = await resolveFacilityId(req);
        const organizationId = resolveOrganizationId(req);
        const dto = plainToInstance(CreateStorageLocationDto, req.body);
        const errors = await validate(dto);

        if (errors.length > 0) {
            throw new AppError('Validation failed', 400);
        }

        const location = this.repository.create({
            ...dto,
            facility_id: facilityId,
            organization_id: organizationId ?? null,
        });

        const saved = await this.repository.save(location);
        res.status(201).json(saved);
    };

    getAll = async (req: Request, res: Response) => {
        const facilityId = await resolveFacilityId(req);
        const locations = await this.repository.find({
            where: { facility_id: facilityId, is_active: true },
            order: { name: 'ASC' },
        });
        res.json(locations);
    };

    getOne = async (req: Request, res: Response) => {
        const facilityId = await resolveFacilityId(req);
        const location = await this.repository.findOne({
            where: { id: parseInt(req.params.id), facility_id: facilityId },
        });

        if (!location) {
            throw new AppError('Storage location not found', 404);
        }

        res.json(location);
    };

    update = async (req: Request, res: Response) => {
        const facilityId = await resolveFacilityId(req);
        const location = await this.repository.findOne({
            where: { id: parseInt(req.params.id), facility_id: facilityId },
        });

        if (!location) {
            throw new AppError('Storage location not found', 404);
        }

        const dto = plainToInstance(UpdateStorageLocationDto, req.body);
        const errors = await validate(dto);

        if (errors.length > 0) {
            throw new AppError('Validation failed', 400);
        }

        Object.assign(location, dto);
        const saved = await this.repository.save(location);
        res.json(saved);
    };

    delete = async (req: Request, res: Response) => {
        const facilityId = await resolveFacilityId(req);
        const location = await this.repository.findOne({
            where: { id: parseInt(req.params.id), facility_id: facilityId },
            relations: ['stocks'],
        });

        if (!location) {
            throw new AppError('Storage location not found', 404);
        }

        // Only allow delete if no active stock
        const activeStocks = location.stocks?.filter((s) => s.quantity > 0 && !s.is_deleted);
        if (activeStocks && activeStocks.length > 0) {
            throw new AppError('Cannot delete location with active stock', 400);
        }

        location.is_active = false;
        await this.repository.save(location);
        res.status(204).send();
    };
}
