import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User.entity';
import { ResponseUtil } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';
import { UserRole } from '../entities/User.entity';
import { AuthService } from '../services/auth.service';
import { AdminUpdateUserDto } from '../dto/auth.dto';
import { resolveOrganizationId } from '../utils/request.util';

export class UserController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    create = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as AuthRequest).user;
            if (!user?.userId) {
                ResponseUtil.error(res, 'Unauthorized', 401);
                return;
            }
            if (user.role === UserRole.SUPER_ADMIN) {
                const orgId = resolveOrganizationId(req);
                if (!orgId) {
                    ResponseUtil.error(res, 'Organization context missing', 400);
                    return;
                }
                if (req.body?.organization_id != null && Number(req.body.organization_id) !== orgId) {
                    ResponseUtil.error(res, 'Super Admin cannot create staff outside the active organization context', 403);
                    return;
                }
                req.body.organization_id = orgId;
            }
            const created = await this.authService.createStaff(user.userId, req.body);
            ResponseUtil.created(res, created, 'Staff member added successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to add staff', error.message);
            }
        }
    };

    findAll = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as AuthRequest).user;
            const page = parseInt(req.query.page as string) || 1;
            const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
            const search = (req.query.search as string)?.trim();
            const roleFilter = req.query.role as string | undefined;
            const facilityFilter = req.query.facility_id as string | undefined;
            const statusFilter = req.query.status as string | undefined;
            const organizationId = resolveOrganizationId(req);
            
            const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
            if (!organizationId && !isSuperAdmin) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const repo = AppDataSource.getRepository(User);
            const qb = repo
                .createQueryBuilder('u')
                .select([
                    'u.id',
                    'u.email',
                    'u.phone_number',
                    'u.first_name',
                    'u.last_name',
                    'u.role',
                    'u.organization_id',
                    'u.facility_id',
                    'u.is_active',
                    'u.created_at',
                ])
                .where('u.deleted_at IS NULL');

            if (user?.role === UserRole.FACILITY_ADMIN && user?.facilityId) {
                qb.andWhere('u.facility_id = :facId', { facId: user.facilityId });
            } else if (organizationId) {
                qb.andWhere('u.organization_id = :orgId', { orgId: organizationId });
            }
            
            if (search) {
                qb.andWhere(
                    '(u.email ILIKE :search OR u.first_name ILIKE :search OR u.last_name ILIKE :search OR u.phone_number ILIKE :search)',
                    { search: `%${search}%` },
                );
            }
            if (roleFilter) {
                qb.andWhere('u.role = :role', { role: roleFilter });
            }
            if (facilityFilter) {
                qb.andWhere('u.facility_id = :facilityId', { facilityId: parseInt(facilityFilter) });
            }
            if (statusFilter) {
                if (statusFilter === 'active') {
                    qb.andWhere('u.is_active = true');
                } else if (statusFilter === 'inactive') {
                    qb.andWhere('u.is_active = false');
                }
            }

            const skip = (page - 1) * limit;
            const [data, total] = await qb.orderBy('u.created_at', 'DESC').skip(skip).take(limit).getManyAndCount();

            const totalPages = Math.ceil(total / limit);
            ResponseUtil.success(
                res,
                {
                    data,
                    total,
                    page,
                    limit,
                    totalPages,
                },
                'Users retrieved successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve users', error?.message);
        }
    };

    findOne = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = (req as AuthRequest).user;
            const organizationId = resolveOrganizationId(req);
            
            const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
            if (!organizationId && !isSuperAdmin) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const repo = AppDataSource.getRepository(User);
            const target = await repo.findOne({
                where: { id, deleted_at: null as any },
                select: [
                    'id',
                    'email',
                    'phone_number',
                    'first_name',
                    'last_name',
                    'role',
                    'organization_id',
                    'facility_id',
                    'is_active',
                    'created_at',
                ],
            });
            if (!target) {
                ResponseUtil.error(res, 'User not found', 404);
                return;
            }
            if (
                user?.role === UserRole.OWNER &&
                organizationId &&
                (target as any).organization_id !== organizationId
            ) {
                ResponseUtil.error(res, 'You do not have permission to view this user', 403);
                return;
            }
            if (
                user?.role === UserRole.FACILITY_ADMIN &&
                user?.facilityId &&
                (target as any).facility_id !== user.facilityId
            ) {
                ResponseUtil.error(res, 'You do not have permission to view this user', 403);
                return;
            }
            if (isSuperAdmin && organizationId && (target as any).organization_id !== organizationId) {
                ResponseUtil.error(res, 'You do not have permission to view this user in this context', 403);
                return;
            }
            ResponseUtil.success(res, target, 'User retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve user', error?.message);
        }
    };

    update = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = (req as AuthRequest).user;
            const organizationId = resolveOrganizationId(req);
            
            const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
            if (!organizationId && !isSuperAdmin) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const repo = AppDataSource.getRepository(User);
            const target = await repo.findOne({
                where: { id, deleted_at: null as any },
                select: ['id', 'organization_id', 'facility_id', 'role'],
            });
            if (!target) {
                ResponseUtil.error(res, 'User not found', 404);
                return;
            }
            if (
                user?.role === UserRole.OWNER &&
                organizationId &&
                (target as any).organization_id !== organizationId
            ) {
                ResponseUtil.error(res, 'You do not have permission to update this user', 403);
                return;
            }
            if (
                user?.role === UserRole.FACILITY_ADMIN &&
                (user?.facilityId == null || (target as any).facility_id !== user.facilityId)
            ) {
                ResponseUtil.error(res, 'You do not have permission to update this user', 403);
                return;
            }
            const body = req.body as AdminUpdateUserDto;
            if (
                user?.role === UserRole.OWNER &&
                body.organization_id != null &&
                body.organization_id !== organizationId
            ) {
                ResponseUtil.error(res, 'You cannot assign a user to another organization', 403);
                return;
            }
            if (isSuperAdmin) {
                if (organizationId && (target as any).organization_id !== organizationId) {
                    ResponseUtil.error(res, 'You do not have permission to update this user in this context', 403);
                    return;
                }
                if (body.organization_id != null && organizationId && body.organization_id !== organizationId) {
                    ResponseUtil.error(res, 'Super Admin cannot reassign users outside the active organization context', 403);
                    return;
                }
            }
            const full = await repo.findOne({ where: { id } });
            if (!full) {
                ResponseUtil.error(res, 'User not found', 404);
                return;
            }
            if (body.first_name != null) full.first_name = body.first_name;
            if (body.last_name != null) full.last_name = body.last_name;
            if (body.email != null) full.email = body.email;
            if (body.role != null) full.role = body.role as UserRole;
            if (body.organization_id != null) full.organization_id = body.organization_id;
            if (body.facility_id != null) full.facility_id = body.facility_id;
            if (body.is_active != null) full.is_active = body.is_active;
            if (body.phone_number != null) full.phone_number = body.phone_number;
            if (body.address != null) full.address = body.address;
            await repo.save(full);
            delete (full as any).password_hash;
            ResponseUtil.success(res, full, 'User updated successfully');
        } catch (error: any) {
            if (error.code === '23505') {
                if (error.detail.includes('phone_number')) {
                    ResponseUtil.conflict(res, 'Phone number already in use');
                } else if (error.detail.includes('email')) {
                    ResponseUtil.conflict(res, 'Email already in use');
                } else {
                    ResponseUtil.conflict(res, 'Duplicate entry found');
                }
                return;
            }
            ResponseUtil.internalError(res, 'Failed to update user', error?.message);
        }
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = parseInt(req.params.id);
            const user = (req as AuthRequest).user;
            const organizationId = resolveOrganizationId(req);
            
            const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;
            if (!organizationId && !isSuperAdmin) {
                ResponseUtil.error(res, 'Organization context missing', 400);
                return;
            }

            const repo = AppDataSource.getRepository(User);
            const target = await repo.findOne({
                where: { id, deleted_at: null as any },
                select: ['id', 'organization_id', 'facility_id', 'role'],
            });

            if (!target) {
                ResponseUtil.error(res, 'User not found', 404);
                return;
            }

            if (
                user?.role === UserRole.OWNER &&
                organizationId &&
                (target as any).organization_id !== organizationId
            ) {
                ResponseUtil.error(res, 'You do not have permission to delete this user', 403);
                return;
            }

            if (
                user?.role === UserRole.FACILITY_ADMIN &&
                (user?.facilityId == null || (target as any).facility_id !== user.facilityId)
            ) {
                ResponseUtil.error(res, 'You do not have permission to delete this user', 403);
                return;
            }
            if (isSuperAdmin && organizationId && (target as any).organization_id !== organizationId) {
                ResponseUtil.error(res, 'You do not have permission to delete this user in this context', 403);
                return;
            }

            await this.authService.softDeleteAccount(id);
            ResponseUtil.success(res, null, 'User archived successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to archive user', error?.message);
            }
        }
    };
}
