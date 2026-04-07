import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Department } from '../../entities/Department.entity';
import { Facility } from '../../entities/Facility.entity';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../dto/pharmacy.dto';

export class DepartmentService {
    private departmentRepository: Repository<Department>;
    private facilityRepository: Repository<Facility>;

    constructor() {
        this.departmentRepository = AppDataSource.getRepository(Department);
        this.facilityRepository = AppDataSource.getRepository(Facility);
    }

    async create(createDto: CreateDepartmentDto): Promise<Department> {
        const facility = await this.facilityRepository.findOne({
            where: { id: createDto.facility_id! },
        });

        if (!facility) {
            throw new AppError('Facility not found', 404);
        }

        if (!facility.departments_enabled) {
            throw new AppError('This facility does not support departments', 400);
        }

        const existing = await this.departmentRepository.findOne({
            where: {
                facility_id: createDto.facility_id,
                name: createDto.name,
            },
        });

        if (existing) {
            throw new AppError('Department with this name already exists in this facility', 409);
        }

        const department = this.departmentRepository.create(createDto);
        return await this.departmentRepository.save(department);
    }

    async findAll(
        facilityId?: number,
        page: number = 1,
        limit: number = 10,
    ): Promise<{ data: Department[]; total: number; page: number; limit: number }> {
        const queryBuilder = this.departmentRepository
            .createQueryBuilder('department')
            .leftJoinAndSelect('department.facility', 'facility');

        if (facilityId) {
            queryBuilder.where('department.facility_id = :facilityId', { facilityId });
        }

        queryBuilder.andWhere('department.is_active = :isActive', { isActive: true });

        const skip = (page - 1) * limit;
        const [data, total] = await queryBuilder
            .skip(skip)
            .take(limit)
            .orderBy('department.name', 'ASC')
            .getManyAndCount();

        return { data, total, page, limit };
    }

    async findOne(id: number, facilityId?: number): Promise<Department> {
        const where: any = { id };
        if (facilityId) {
            where.facility_id = facilityId;
        }

        const department = await this.departmentRepository.findOne({
            where,
            relations: ['facility', 'stocks'],
        });

        if (!department) {
            throw new AppError('Department not found', 404);
        }

        return department;
    }

    async update(id: number, updateDto: UpdateDepartmentDto, facilityId?: number): Promise<Department> {
        const department = await this.findOne(id, facilityId);
        Object.assign(department, updateDto);
        return await this.departmentRepository.save(department);
    }

    async delete(id: number, facilityId?: number): Promise<void> {
        const department = await this.findOne(id, facilityId);
        await this.departmentRepository.remove(department);
    }
}
