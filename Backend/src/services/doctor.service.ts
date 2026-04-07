import { Repository } from 'typeorm';
import { Doctor } from '../entities/Doctor.entity';
import { AppDataSource } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateDoctorDto, UpdateDoctorDto } from '../dto/index.dto';
import { User } from '../entities/User.entity';
import { requireOrganizationId } from '../utils/tenant.util';

export class DoctorService {
    private doctorRepository: Repository<Doctor>;
    private userRepository: Repository<User>;

    constructor() {
        this.doctorRepository = AppDataSource.getRepository(Doctor);
        this.userRepository = AppDataSource.getRepository(User);
    }

    async create(createDoctorDto: CreateDoctorDto, organizationId: number): Promise<Doctor> {
        organizationId = requireOrganizationId(organizationId);
        const existingDoctor = await this.doctorRepository.findOne({
            where: { license_number: createDoctorDto.license_number },
        });

        if (existingDoctor) {
            throw new AppError('Doctor with this license number already exists', 409);
        }

        const user = await this.userRepository.findOne({
            where: { id: createDoctorDto.user_id, organization_id: organizationId },
        });
        if (!user) {
            throw new AppError('Doctor user not found in your organization', 404);
        }

        const doctor = this.doctorRepository.create(createDoctorDto);
        return await this.doctorRepository.save(doctor);
    }

    async findAll(filters?: {
        specialization?: string;
        is_available?: boolean;
        facility_id?: number;
        organization_id?: number;
    }): Promise<Doctor[]> {
        const organizationId = requireOrganizationId(filters?.organization_id);
        const query = this.doctorRepository
            .createQueryBuilder('doctor')
            .leftJoinAndSelect('doctor.user', 'user')
            .where('user.organization_id = :organizationId', { organizationId });

        if (filters?.specialization) {
            query.andWhere('doctor.specialization = :specialization', {
                specialization: filters.specialization,
            });
        }

        if (filters?.is_available !== undefined) {
            query.andWhere('doctor.is_available = :is_available', {
                is_available: filters.is_available,
            });
        }

        if (filters?.facility_id) {
            query.andWhere('user.facility_id = :facility_id', { facility_id: filters.facility_id });
        }

        return await query.getMany();
    }

    async findOne(id: number, organizationId: number): Promise<Doctor> {
        const doctor = await this.doctorRepository.findOne({
            where: { id, user: { organization_id: requireOrganizationId(organizationId) } },
            relations: ['user'],
        });

        if (!doctor) {
            throw new AppError('Doctor not found', 404);
        }

        return doctor;
    }

    async update(id: number, organizationId: number, updateDoctorDto: UpdateDoctorDto): Promise<Doctor> {
        const doctor = await this.findOne(id, organizationId);
        Object.assign(doctor, updateDoctorDto);
        return await this.doctorRepository.save(doctor);
    }

    async getSpecializations(organizationId: number): Promise<string[]> {
        const result = await this.doctorRepository
            .createQueryBuilder('doctor')
            .innerJoin('doctor.user', 'user')
            .select('DISTINCT doctor.specialization', 'specialization')
            .where('user.organization_id = :organizationId', { organizationId: requireOrganizationId(organizationId) })
            .getRawMany();

        return result.map((r) => r.specialization);
    }
}
