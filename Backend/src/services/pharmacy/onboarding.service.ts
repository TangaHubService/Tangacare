import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Organization } from '../../entities/Organization.entity';
import { Facility } from '../../entities/Facility.entity';
import { User, UserRole } from '../../entities/User.entity';
import { CreateOnboardingSetupDto, CreateOnboardingOrganizationDto } from '../../dto/pharmacy.dto';
import { OrganizationType } from '../../entities/Organization.entity';

export class OnboardingService {
    private organizationRepository: Repository<Organization>;
    private facilityRepository: Repository<Facility>;
    private userRepository: Repository<User>;

    constructor() {
        this.organizationRepository = AppDataSource.getRepository(Organization);
        this.facilityRepository = AppDataSource.getRepository(Facility);
        this.userRepository = AppDataSource.getRepository(User);
    }

    async createOrganizationOnly(
        userId: number,
        dto: CreateOnboardingOrganizationDto,
    ): Promise<{ organization: Organization }> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new AppError('User not found', 404);
        }
        if (user.organization_id != null) {
            throw new AppError('You already have an organization. Use Facilities to add branches.', 400);
        }

        const existingOrg = await this.organizationRepository.findOne({
            where: { name: dto.organization_name },
        });
        if (existingOrg) {
            throw new AppError('An organization with this name already exists', 409);
        }
        if (dto.organization_code) {
            const existingCode = await this.organizationRepository.findOne({
                where: { code: dto.organization_code },
            });
            if (existingCode) {
                throw new AppError('An organization with this code already exists', 409);
            }
        }

        const org = this.organizationRepository.create({
            name: dto.organization_name,
            code: dto.organization_code,
            legal_name: dto.legal_name,
            registration_number: dto.registration_number,
            medical_license: dto.medical_license,
            city: dto.city,
            country: dto.country,
            type: OrganizationType.SINGLE_PHARMACY,
            is_active: true,
        });
        const savedOrg = await this.organizationRepository.save(org);


        await this.userRepository.update(userId, {
            organization_id: savedOrg.id,
            facility_id: null as any,
            role: UserRole.OWNER,
        });

        return { organization: savedOrg };
    }

    async setupOrganizationWithFirstFacility(
        userId: number,
        dto: CreateOnboardingSetupDto,
    ): Promise<{ organization: Organization; facility: Facility }> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new AppError('User not found', 404);
        }
        if (user.organization_id != null) {
            throw new AppError('You already have an organization. Use Facilities to add more branches.', 400);
        }

        const existingOrg = await this.organizationRepository.findOne({
            where: { name: dto.organization_name },
        });
        if (existingOrg) {
            throw new AppError('An organization with this name already exists', 409);
        }

        const org = this.organizationRepository.create({
            name: dto.organization_name,
            code: dto.organization_code,
            legal_name: dto.legal_name,
            registration_number: dto.registration_number,
            medical_license: dto.medical_license,
            city: dto.city,
            country: dto.country,
            type: OrganizationType.SINGLE_PHARMACY,
            is_active: true,
        });
        const savedOrg = await this.organizationRepository.save(org);


        const existingFacility = await this.facilityRepository.findOne({
            where: { name: dto.facility_name, organization_id: savedOrg.id },
        });
        if (existingFacility) {
            throw new AppError('A facility with this name already exists in this organization', 409);
        }

        const facility = this.facilityRepository.create({
            name: dto.facility_name,
            type: dto.facility_type,
            organization_id: savedOrg.id,
            facility_admin_id: userId,
            address: dto.address,
            phone: dto.phone,
            email: dto.email,
            is_active: true,
            departments_enabled: dto.facility_type === 'hospital',
        });
        const savedFacility = await this.facilityRepository.save(facility);

        await this.userRepository.update(userId, {
            organization_id: savedOrg.id,
            facility_id: savedFacility.id,
            role: UserRole.OWNER,
        });


        return { organization: savedOrg, facility: savedFacility };
    }
}
