import { Repository } from 'typeorm';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User, UserRole } from '../entities/User.entity';
import { AppDataSource } from '../config/database';
import { JwtUtil } from '../utils/jwt.util';
import { AppError } from '../middleware/error.middleware';
import { RegisterDto, LoginDto, UpdateUserDto, CreateStaffDto } from '../dto/auth.dto';
import { EmailUtil } from '../utils/email.util';
import { getPermissionsForRole } from '../config/permissions';

/** C-5: Hash a plaintext OTP with SHA-256 before storing in the DB */
const hashOtp = (otp: string): string => crypto.createHash('sha256').update(otp).digest('hex');


export class AuthService {
    private userRepository: Repository<User>;

    constructor() {
        this.userRepository = AppDataSource.getRepository(User);
    }

    async register(registerDto: RegisterDto): Promise<{ message: string; otp?: string; userId?: number }> {
        const whereConditions: any[] = [];
        if (registerDto.phone_number) whereConditions.push({ phone_number: registerDto.phone_number });
        if (registerDto.email) whereConditions.push({ email: registerDto.email });

        if (whereConditions.length > 0) {
            const existingUser = await this.userRepository.findOne({
                where: whereConditions,
            });

            if (existingUser) {
                throw new AppError('User with this phone number or email already exists', 409);
            }
        } else {
            throw new AppError('Either phone number or email is required', 400);
        }

        const password_hash = await bcrypt.hash(registerDto.password, 10);

        const { generateOtp, getOtpExpiry } = await import('../utils/otp.util');
        const otp = generateOtp();
        const otpExpiry = getOtpExpiry();

        let organization_id: number | undefined;
        let facility_id: number | undefined;
        let finalRole: UserRole = registerDto.role || UserRole.USER;


        if (registerDto.invite_code) {
            const { Invitation, InvitationStatus } = await import('../entities/Invitation.entity');
            const invitationRepo = AppDataSource.getRepository(Invitation);
            const invite = await invitationRepo.findOne({
                where: { code: registerDto.invite_code, status: InvitationStatus.PENDING },
            });

            if (invite) {
                if (invite.expires_at > new Date()) {
                    organization_id = invite.organization_id;
                    facility_id = invite.facility_id || undefined;
                    finalRole = invite.role;
                    invite.status = InvitationStatus.ACCEPTED;
                    await invitationRepo.save(invite);
                }
            }
        }

        const user = this.userRepository.create({
            ...registerDto,
            password_hash,
            otp_code: hashOtp(otp),  // C-5: store hash, not plaintext
            otp_expires_at: otpExpiry,
            is_verified: false,
            role: finalRole,
            organization_id,
            facility_id,
        });

        await this.userRepository.save(user);

        if (registerDto.email) {
            await EmailUtil.sendVerificationEmail(registerDto.email, registerDto.first_name, otp);
        } else {
        }

        const response: any = {
            message: 'User registered successfully. Please verify your account using the OTP sent.',
            userId: user.id,
        };

        if (process.env.NODE_ENV === 'development') {
            response.otp = otp;
        }

        return response;
    }

    async createStaff(creatorUserId: number, dto: CreateStaffDto): Promise<User> {
        const creator = await this.userRepository.findOne({ where: { id: creatorUserId } });
        if (!creator) throw new AppError('Creator user not found', 404);
        if (
            creator.role !== UserRole.OWNER &&
            creator.role !== UserRole.SUPER_ADMIN &&
            creator.role !== UserRole.FACILITY_ADMIN
        ) {
            throw new AppError('Only organization owners, super admins, or facility admins can add staff', 403);
        }

        let organizationId: number | undefined;
        let effectiveFacilityId: number | undefined;
        let facility: { name: string } | null = null;

        if (creator.role === UserRole.FACILITY_ADMIN) {
            if (!creator.facility_id) {
                throw new AppError('You must be assigned to a facility to add staff', 400);
            }
            const { Facility } = await import('../entities/Facility.entity');
            const facilityRepo = AppDataSource.getRepository(Facility);
            const fac = await facilityRepo.findOne({
                where: { id: creator.facility_id },
                select: ['id', 'organization_id', 'name'],
            });
            if (!fac) throw new AppError('Your facility was not found', 400);
            organizationId = fac.organization_id ?? undefined;
            effectiveFacilityId = creator.facility_id;
            facility = fac;
        } else {
            organizationId =
                creator.role === UserRole.OWNER ? (creator.organization_id ?? undefined) : dto.organization_id;
            effectiveFacilityId = dto.facility_id ?? undefined;
        }

        if (dto.role === UserRole.FACILITY_ADMIN && !effectiveFacilityId) {
            throw new AppError('Facility ID is mandatory for Facility Admin role', 400);
        }

        if (creator.role === UserRole.OWNER && !organizationId) {
            throw new AppError('Your account is not linked to an organization', 400);
        }

        if (dto.email) {
            const existing = await this.userRepository.findOne({ where: { email: dto.email } });
            if (existing) throw new AppError('A user with this email already exists', 409);
        }

        if (effectiveFacilityId && organizationId && !facility) {
            const { Facility } = await import('../entities/Facility.entity');
            const facilityRepo = AppDataSource.getRepository(Facility);
            const fac = await facilityRepo.findOne({
                where: { id: effectiveFacilityId, organization_id: organizationId },
            });
            if (!fac) throw new AppError('Facility does not belong to your organization', 400);
            facility = fac;
        }

        const mustSetPassword = !dto.password || dto.password.trim() === '';
        const plainPassword: string = mustSetPassword
            ? `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
            : (dto.password as string);
        const password_hash = await bcrypt.hash(plainPassword, 10);
        const { generateOtp, getOtpExpiry } = await import('../utils/otp.util');
        const otp = generateOtp();
        const otpExpiry = getOtpExpiry();

        const user = this.userRepository.create({
            email: dto.email,
            first_name: dto.first_name,
            last_name: dto.last_name,
            password_hash,
            role: dto.role as UserRole,
            phone_number: dto.phone_number,
            organization_id: organizationId ?? undefined,
            facility_id: effectiveFacilityId ?? undefined,
            otp_code: hashOtp(otp),  // C-5: store hash, not plaintext
            otp_expires_at: otpExpiry,
            is_verified: false,
            must_set_password: mustSetPassword,
        } as Partial<User>);
        await this.userRepository.save(user);

        if (dto.email) {
            const { Organization } = await import('../entities/Organization.entity');
            const orgRepo = AppDataSource.getRepository(Organization);
            const org = organizationId ? await orgRepo.findOne({ where: { id: organizationId } }) : null;
            const orgName = org?.name ?? 'Your organization';
            const facilityName = facility?.name;
            const roleLabels: Record<string, string> = {
                facility_admin: 'Facility Admin',
                pharmacist: 'Pharmacist',
                store_manager: 'Store Manager',
                auditor: 'Auditor',
                cashier: 'Cashier',
            };
            const roleLabel = roleLabels[dto.role] ?? dto.role;
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const verificationLink = `${frontendUrl}/auth/verify-otp?email=${encodeURIComponent(dto.email)}&type=register`;
            await EmailUtil.sendStaffWelcomeEmail(
                dto.email,
                dto.first_name,
                otp,
                roleLabel,
                orgName,
                verificationLink,
                facilityName,
            );
        }

        delete (user as any).password_hash;
        return user;
    }

    async login(loginDto: LoginDto): Promise<{
        user: User & { permissions?: string[] };
        tokens: any;
        hasFacility?: boolean;
        facility?: any;
        organizations?: any[];
        facilities?: any[];
    }> {
        const user = await this.userRepository.findOne({
            where: [{ phone_number: loginDto.identifier }, { email: loginDto.identifier }],
            relations: ['organization', 'facility'],
        });

        if (!user) {
            throw new AppError('Invalid credentials', 401);
        }

        if (!user.is_active || user.deleted_at) {
            throw new AppError('Account has been deactivated', 403);
        }

        const isPasswordValid = await bcrypt.compare(loginDto.password, user.password_hash);

        if (!isPasswordValid) {
            throw new AppError('Invalid credentials', 401);
        }

        if (!user.is_verified) {
            const { generateOtp, getOtpExpiry } = await import('../utils/otp.util');
            const otp = generateOtp();
            const otpExpiry = getOtpExpiry();

            user.otp_code = hashOtp(otp);
            user.otp_expires_at = otpExpiry;
            await this.userRepository.save(user);


            if (user.email) {
                await EmailUtil.sendVerificationEmail(user.email, user.first_name, otp);
            } else {
            }

            if (process.env.NODE_ENV === 'development') {
                console.log(`[DEV] Login OTP for unverified user: ${otp}`);
            }

            throw new AppError('Account not verified. Please verify your account using the OTP sent.', 403);
        }

        const orgId = user.organization_id ?? (user.facility as any)?.organization_id ?? null;
        const tokens = JwtUtil.generateTokenPair({
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.role === UserRole.SUPER_ADMIN ? undefined : (orgId ?? undefined),
            facilityId: user.role === UserRole.SUPER_ADMIN ? undefined : (user.facility_id ?? undefined),
        });

        delete (user as any).password_hash;

        let hasFacility = false;
        let facility = null;
        let organizations: any[] = [];
        let facilities: any[] = [];

        if (user.role === UserRole.FACILITY_ADMIN) {
            const { FacilityService } = await import('./pharmacy/facility.service');
            const facilityService = new FacilityService();
            if (orgId) {
                facility = await facilityService.findByAdminId(user.id, orgId);
            }
            if (!facility && user.facility_id && orgId) {
                facility = await facilityService.findOne(user.facility_id, orgId);
            }
            hasFacility = !!facility;

            if (facility) {
                facilities = [facility];
                const facOrgId = (facility as any).organization_id;
                if (facOrgId) {
                    const { Organization } = await import('../entities/Organization.entity');
                    const orgRepo = AppDataSource.getRepository(Organization);
                    const org = await orgRepo.findOne({ where: { id: facOrgId } });
                    if (org) {
                        organizations = [{ id: org.id, name: org.name, code: org.code, type: org.type }];
                    }
                }
            }
        } else if (orgId && user.role !== UserRole.SUPER_ADMIN) {
            const { FacilityService } = await import('./pharmacy/facility.service');
            const { Organization } = await import('../entities/Organization.entity');
            const facilityService = new FacilityService();
            const orgRepo = AppDataSource.getRepository(Organization);
            const org = await orgRepo.findOne({ where: { id: orgId } });
            if (org) {
                organizations = [{ id: org.id, name: org.name, code: org.code, type: org.type }];
                facilities = await facilityService.findByOrganizationId(orgId);
            }
        }

        if (!facility && user.facility_id) {
            const { FacilityService } = await import('./pharmacy/facility.service');
            const facilityService = new FacilityService();
            try {
                if (orgId) {
                    facility = await facilityService.findOne(user.facility_id, orgId);
                }
                if (facility && !hasFacility) hasFacility = true;
            } catch { }
        }

        const permissions = getPermissionsForRole(user.role).slice();
        return { user: { ...user, permissions }, tokens, hasFacility, facility, organizations, facilities };
    }

    async refreshToken(refreshToken: string): Promise<any> {
        try {
            const decoded = JwtUtil.verifyRefreshToken(refreshToken);

            const user = await this.userRepository.findOne({
                where: { id: decoded.userId },
            });

            if (!user) {
                throw new AppError('User not found', 404);
            }

            let orgId: number | undefined;
            let facilityId: number | undefined;

            if (user.role === UserRole.SUPER_ADMIN) {
                // Preserve SUPER_ADMIN impersonation context embedded in the refresh token.
                orgId = decoded.organizationId;
                facilityId = decoded.facilityId;

                if (facilityId && orgId) {
                    const { Facility } = await import('../entities/Facility.entity');
                    const fac = await AppDataSource.getRepository(Facility).findOne({
                        where: { id: facilityId },
                        select: ['id', 'organization_id'],
                    });
                    if (!fac || fac.organization_id !== orgId) {
                        throw new AppError('Invalid impersonation facility scope', 401);
                    }
                }
            } else {
                orgId = user.organization_id ?? undefined;
                facilityId = user.facility_id ?? undefined;
            }

            const tokens = JwtUtil.generateTokenPair({
                userId: user.id,
                email: user.email,
                role: user.role,
                organizationId: orgId,
                facilityId,
            });

            return tokens;
        } catch (error) {
            throw new AppError('Invalid refresh token', 401);
        }
    }

    async getProfile(userId: number): Promise<
        User & {
            hasFacility?: boolean;
            facility?: any;
            organizations?: any[];
            facilities?: any[];
            permissions?: string[];
        }
    > {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['doctor', 'organization', 'facility'],
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        delete (user as any).password_hash;

        let hasFacility = false;
        let facility = null;
        let organizations: any[] = [];
        let facilities: any[] = [];
        const orgId = user.organization_id ?? (user.facility as any)?.organization_id ?? null;

        if (user.role === UserRole.FACILITY_ADMIN || user.role === UserRole.OWNER) {
            const { FacilityService } = await import('./pharmacy/facility.service');
            const facilityService = new FacilityService();
            if (orgId) {
                facility = await facilityService.findByAdminId(user.id, orgId);
            }
            if (!facility && user.facility_id && orgId) {
                facility = await facilityService.findOne(user.facility_id, orgId);
            }
            hasFacility = !!facility;

            if (user.role === UserRole.FACILITY_ADMIN && facility) {
                facilities = [facility];
                const facOrgId = (facility as any).organization_id;
                if (facOrgId) {
                    const { Organization } = await import('../entities/Organization.entity');
                    const orgRepo = AppDataSource.getRepository(Organization);
                    const org = await orgRepo.findOne({ where: { id: facOrgId } });
                    if (org) {
                        organizations = [{ id: org.id, name: org.name, code: org.code, type: org.type }];
                    }
                }
            }
        }

        if (orgId && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.FACILITY_ADMIN) {
            const { FacilityService } = await import('./pharmacy/facility.service');
            const { Organization } = await import('../entities/Organization.entity');
            const facilityService = new FacilityService();
            const orgRepo = AppDataSource.getRepository(Organization);
            const org = await orgRepo.findOne({ where: { id: orgId } });
            if (org) {
                organizations = [{ id: org.id, name: org.name, code: org.code, type: org.type }];
                facilities = await facilityService.findByOrganizationId(orgId);
            }
        }

        if (user.role === UserRole.SUPER_ADMIN) {
            const { Organization } = await import('../entities/Organization.entity');
            const orgRepo = AppDataSource.getRepository(Organization);
            organizations = await orgRepo.find({ take: 100, order: { name: 'ASC' } });
            facilities = [];
        }

        if (!facility && user.facility_id) {
            const { FacilityService } = await import('./pharmacy/facility.service');
            const facilityService = new FacilityService();
            try {
                if (orgId) {
                    facility = await facilityService.findOne(user.facility_id, orgId);
                }
                if (facility && !hasFacility) hasFacility = true;
            } catch { }
        }

        const permissions = getPermissionsForRole(user.role).slice();
        return { ...user, hasFacility, facility, organizations, facilities, permissions };
    }

    async updateProfile(userId: number, updateDto: UpdateUserDto): Promise<User> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        Object.assign(user, updateDto);

        await this.userRepository.save(user);

        delete (user as any).password_hash;
        return user;
    }

    async verifyOtp(identifier: string, otp: string): Promise<{ user: User; tokens: any }> {
        const user = await this.userRepository.findOne({
            where: [{ phone_number: identifier }, { email: identifier }],
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // C-5: Compare SHA-256 hash of incoming OTP against stored hash.
        // Development backdoor removed — all paths go through hash comparison.
        const inputHash = hashOtp(otp);
        if (user.otp_code !== inputHash) {
            throw new AppError('Invalid OTP', 400);
        }

        const { isOtpExpired } = await import('../utils/otp.util');
        if (user.otp_expires_at && isOtpExpired(user.otp_expires_at)) {
            throw new AppError('OTP has expired', 400);
        }

        user.is_verified = true;
        user.otp_code = null as any;
        user.otp_expires_at = null as any;
        await this.userRepository.save(user);

        const orgId = user.organization_id ?? null;
        const tokens = JwtUtil.generateTokenPair({
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.role === UserRole.SUPER_ADMIN ? undefined : (orgId ?? undefined),
            facilityId: user.role === UserRole.SUPER_ADMIN ? undefined : (user.facility_id ?? undefined),
        });

        delete (user as any).password_hash;
        const mustSetPassword = !!(user as any).must_set_password;
        return { user, tokens, mustSetPassword } as {
            user: User;
            tokens: any;
            mustSetPassword?: boolean;
        };
    }

    async setInitialPassword(userId: number, newPassword: string): Promise<User> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new AppError('User not found', 404);
        if (!(user as any).must_set_password) {
            throw new AppError('You have already set your password', 400);
        }
        user.password_hash = await bcrypt.hash(newPassword, 10);
        (user as any).must_set_password = false;
        await this.userRepository.save(user);
        delete (user as any).password_hash;
        return user;
    }

    async softDeleteAccount(userId: number): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        user.is_active = false;
        user.deleted_at = new Date();

        await this.userRepository.save(user);
    }

    async requestPasswordReset(identifier: string): Promise<{ message: string; otp?: string }> {
        const user = await this.userRepository.findOne({
            where: [{ email: identifier }, { phone_number: identifier }],
        });

        if (!user) {
            return { message: 'If an account exists with this identifier, an OTP has been sent' };
        }

        const { generateOtp, getOtpExpiry } = await import('../utils/otp.util');
        const otp = generateOtp();
        const otpExpiry = getOtpExpiry();

        user.otp_code = hashOtp(otp);  // C-5: store hash, not plaintext
        user.otp_expires_at = otpExpiry;
        await this.userRepository.save(user);

        const isEmail = identifier.includes('@');

        if (isEmail) {
            await EmailUtil.sendPasswordResetEmail(user.email, user.first_name, otp);
        } else {
        }

        if (process.env.NODE_ENV === 'development') {
            return {
                message: 'OTP generated successfully (development mode)',
                otp,
            };
        }

        return { message: 'If an account exists with this identifier, an OTP has been sent' };
    }

    async verifyResetOtp(identifier: string, otp: string): Promise<boolean> {
        const user = await this.userRepository.findOne({
            where: [{ email: identifier }, { phone_number: identifier }],
        });

        if (!user) {
            throw new AppError('Invalid OTP', 400);
        }

        if (!user.otp_code || !user.otp_expires_at) {
            throw new AppError('No OTP request found. Please request a password reset first', 400);
        }

        // C-5: Compare SHA-256 hash of incoming OTP
        const inputHash = hashOtp(otp);
        if (user.otp_code !== inputHash) {
            throw new AppError('Invalid OTP', 400);
        }

        const { isOtpExpired } = await import('../utils/otp.util');
        if (isOtpExpired(user.otp_expires_at)) {
            user.otp_code = null as any;
            user.otp_expires_at = null as any;
            await this.userRepository.save(user);
            throw new AppError('OTP has expired. Please request a new one', 400);
        }

        return true;
    }

    async resetPassword(identifier: string, otp: string, newPassword: string): Promise<{ message: string }> {
        await this.verifyResetOtp(identifier, otp);

        const user = await this.userRepository.findOne({
            where: [{ email: identifier }, { phone_number: identifier }],
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        const password_hash = await bcrypt.hash(newPassword, 10);

        user.password_hash = password_hash;
        user.otp_code = null as any;
        user.otp_expires_at = null as any;

        await this.userRepository.save(user);

        return { message: 'Password reset successfully' };
    }
}
