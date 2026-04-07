import { Repository, MoreThan } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Invitation, InvitationStatus } from '../../entities/Invitation.entity';
import { User, UserRole } from '../../entities/User.entity';
import { Organization } from '../../entities/Organization.entity';
import { v4 as uuidv4 } from 'uuid';

export class InvitationService {
    private invitationRepository: Repository<Invitation>;
    private userRepository: Repository<User>;
    private organizationRepository: Repository<Organization>;

    constructor() {
        this.invitationRepository = AppDataSource.getRepository(Invitation);
        this.userRepository = AppDataSource.getRepository(User);
        this.organizationRepository = AppDataSource.getRepository(Organization);
    }

    async createInvite(data: {
        email: string;
        organization_id: number;
        facility_id?: number | null;
        role: UserRole;
        invited_by_id: number;
    }): Promise<Invitation> {
        const org = await this.organizationRepository.findOneBy({ id: data.organization_id });
        if (!org) throw new AppError('Organization not found', 404);

        const existingInvite = await this.invitationRepository.findOne({
            where: {
                email: data.email,
                organization_id: data.organization_id,
                status: InvitationStatus.PENDING,
                expires_at: MoreThan(new Date()),
            },
        });

        if (existingInvite) {
            throw new AppError('An active invitation already exists for this email', 400);
        }

        const invite = this.invitationRepository.create({
            email: data.email,
            organization_id: data.organization_id,
            facility_id: data.facility_id || undefined,
            role: data.role,
            invited_by_id: data.invited_by_id,
            code: uuidv4().substring(0, 8).toUpperCase(),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: InvitationStatus.PENDING,
        });

        return await this.invitationRepository.save(invite);
    }

    async acceptInvite(userId: number, code: string): Promise<void> {
        const invite = await this.invitationRepository.findOne({
            where: { code, status: InvitationStatus.PENDING },
        });

        if (!invite) throw new AppError('Invalid or expired invitation code', 404);
        if (invite.expires_at < new Date()) {
            invite.status = InvitationStatus.EXPIRED;
            await this.invitationRepository.save(invite);
            throw new AppError('Invitation code has expired', 400);
        }

        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) throw new AppError('User not found', 404);

        await this.userRepository.update(userId, {
            organization_id: invite.organization_id,
            facility_id: invite.facility_id || undefined,
            role: invite.role,
        });

        invite.status = InvitationStatus.ACCEPTED;
        await this.invitationRepository.save(invite);
    }

    async getInviteByCode(code: string): Promise<Invitation> {
        const invite = await this.invitationRepository.findOne({
            where: { code },
            relations: ['organization', 'facility'],
        });
        if (!invite) throw new AppError('Invitation not found', 404);
        return invite;
    }
}
