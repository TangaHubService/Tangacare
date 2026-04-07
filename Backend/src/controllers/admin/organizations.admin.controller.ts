import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { ResponseUtil } from '../../utils/response.util';
import { OrganizationService } from '../../services/pharmacy/organization.service';
import { User, UserRole } from '../../entities/User.entity';
import { Organization } from '../../entities/Organization.entity';
import { Facility } from '../../entities/Facility.entity';
import { JwtUtil } from '../../utils/jwt.util';
import { MedicineService } from '../../services/pharmacy/medicine.service';
import { StockService } from '../../services/pharmacy/stock.service';
import { StockQueryDto } from '../../dto/pharmacy.dto';
import { AuditService } from '../../services/pharmacy/audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';

export class AdminOrganizationsController {
    private organizationService: OrganizationService;
    private medicineService: MedicineService;
    private stockService: StockService;
    private auditService: AuditService;

    constructor() {
        this.organizationService = new OrganizationService();
        this.medicineService = new MedicineService();
        this.stockService = new StockService();
        this.auditService = new AuditService();
    }

    private parseInt(value: any): number | undefined {
        if (value === undefined || value === null || value === '' || value === 'undefined' || value === 'null') return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    listOrganizations = async (req: Request, res: Response): Promise<void> => {
        try {
            const page = this.parseInt(req.query.page) || 1;
            const limit = this.parseInt(req.query.limit) || 20;
            const search = (req.query.search as string | undefined)?.trim();

            const result = await this.organizationService.findAll(page, limit, search, undefined);
            const actor = (req as any).user as { userId: number } | undefined;
            if (actor?.userId) {
                await this.auditService.log({
                    user_id: actor.userId,
                    action: AuditAction.VIEW,
                    entity_type: AuditEntityType.ORGANIZATION,
                    description: `Viewed organizations list (page=${page}, limit=${limit})`,
                    ip_address: req.ip,
                    user_agent: String(req.headers['user-agent'] || ''),
                });
            }
            ResponseUtil.success(res, result, 'Organizations retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve organizations', error?.message);
        }
    };

    listOrganizationUsers = async (req: Request, res: Response): Promise<void> => {
        try {
            const orgId = this.parseInt(req.params.orgId);
            if (!orgId) {
                ResponseUtil.badRequest(res, 'Invalid organization id');
                return;
            }

            const page = this.parseInt(req.query.page) || 1;
            const limit = Math.min(this.parseInt(req.query.limit) || 20, 100);
            const search = (req.query.search as string | undefined)?.trim();
            const roleFilter = (req.query.role as string | undefined)?.trim();
            const facilityFilter = this.parseInt(req.query.facility_id);
            const statusFilter = (req.query.status as string | undefined)?.trim();

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
                .where('u.deleted_at IS NULL')
                .andWhere('u.organization_id = :orgId', { orgId });

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
                qb.andWhere('u.facility_id = :facilityId', { facilityId: facilityFilter });
            }
            if (statusFilter) {
                if (statusFilter === 'active') qb.andWhere('u.is_active = true');
                if (statusFilter === 'inactive') qb.andWhere('u.is_active = false');
            }

            const skip = (page - 1) * limit;
            const [data, total] = await qb.orderBy('u.created_at', 'DESC').skip(skip).take(limit).getManyAndCount();
            const totalPages = Math.ceil(total / limit);

            const actor = (req as any).user as { userId: number } | undefined;
            if (actor?.userId) {
                await this.auditService.log({
                    user_id: actor.userId,
                    organization_id: orgId,
                    action: AuditAction.VIEW,
                    entity_type: AuditEntityType.ORGANIZATION,
                    entity_id: orgId,
                    description: `Viewed organization users (orgId=${orgId}, page=${page}, limit=${limit})`,
                    ip_address: req.ip,
                    user_agent: String(req.headers['user-agent'] || ''),
                });
            }
            ResponseUtil.success(
                res,
                {
                    data,
                    total,
                    page,
                    limit,
                    totalPages,
                },
                'Organization users retrieved successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve organization users', error?.message);
        }
    };

    listOrganizationMedicines = async (req: Request, res: Response): Promise<void> => {
        try {
            const orgId = this.parseInt(req.params.orgId);
            if (!orgId) {
                ResponseUtil.badRequest(res, 'Invalid organization id');
                return;
            }

            const page = this.parseInt(req.query.page) || 1;
            const limit = this.parseInt(req.query.limit) || 10;
            const search = req.query.search as string;
            const isActive =
                req.query.is_active === 'true' ? true : req.query.is_active === 'false' ? false : undefined;
            const startDate = req.query.start_date as string;
            const endDate = req.query.end_date as string;
            const sortBy = req.query.sort_by as string;
            const order = (req.query.order as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const minStock = req.query.min_stock ? this.parseInt(req.query.min_stock) : undefined;
            const category = req.query.category as string | undefined;
            const facilityId = this.parseInt(req.query.facility_id ?? req.query.facilityId);

            // Optional validation: facility belongs to org when provided
            if (facilityId) {
                const facility = await AppDataSource.getRepository(Facility).findOne({
                    where: { id: facilityId },
                    select: ['id', 'organization_id'],
                });
                if (!facility || facility.organization_id !== orgId) {
                    ResponseUtil.forbidden(res, 'Facility does not belong to this organization');
                    return;
                }
            }

            const result = await this.medicineService.findAll(
                page,
                limit,
                search,
                isActive,
                startDate,
                endDate,
                facilityId,
                sortBy,
                order as any,
                minStock,
                category,
                orgId
            );

            const actor = (req as any).user as { userId: number } | undefined;
            if (actor?.userId) {
                await this.auditService.log({
                    user_id: actor.userId,
                    organization_id: orgId,
                    action: AuditAction.VIEW,
                    entity_type: AuditEntityType.ORGANIZATION,
                    entity_id: orgId,
                    description: `Viewed medicines (orgId=${orgId}, page=${page}, limit=${limit})`,
                    new_values: {
                        facility_id: facilityId ?? null,
                        search: search ?? null,
                        category: category ?? null,
                    },
                    ip_address: req.ip,
                    user_agent: String(req.headers['user-agent'] || ''),
                });
            }
            ResponseUtil.success(res, result, 'Medicines retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve medicines', error?.message);
        }
    };

    listOrganizationStock = async (req: Request, res: Response): Promise<void> => {
        try {
            const orgId = this.parseInt(req.params.orgId);
            if (!orgId) {
                ResponseUtil.badRequest(res, 'Invalid organization id');
                return;
            }

            const facilityId = this.parseInt(req.query.facility_id ?? req.query.facilityId);
            if (facilityId) {
                const facility = await AppDataSource.getRepository(Facility).findOne({
                    where: { id: facilityId },
                    select: ['id', 'organization_id'],
                });
                if (!facility || facility.organization_id !== orgId) {
                    ResponseUtil.forbidden(res, 'Facility does not belong to this organization');
                    return;
                }
            }

            const query: StockQueryDto = {
                page: this.parseInt(req.query.page) || 1,
                limit: this.parseInt(req.query.limit) || 10,
                organization_id: orgId,
                facility_id: facilityId,
                department_id: this.parseInt(req.query.department_id),
                medicine_id: this.parseInt(req.query.medicine_id),
                search: (req.query.search as string) || undefined,
                low_stock_only: req.query.low_stock_only === 'true',
            };

            const result = await this.stockService.getStock(query);
            const actor = (req as any).user as { userId: number } | undefined;
            if (actor?.userId) {
                await this.auditService.log({
                    user_id: actor.userId,
                    organization_id: orgId,
                    action: AuditAction.VIEW,
                    entity_type: AuditEntityType.ORGANIZATION,
                    entity_id: orgId,
                    description: `Viewed stock (orgId=${orgId}, page=${query.page}, limit=${query.limit})`,
                    new_values: {
                        facility_id: facilityId ?? null,
                        department_id: query.department_id ?? null,
                        medicine_id: query.medicine_id ?? null,
                        low_stock_only: query.low_stock_only ?? false,
                    },
                    ip_address: req.ip,
                    user_agent: String(req.headers['user-agent'] || ''),
                });
            }
            ResponseUtil.success(res, result, 'Stock retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve stock', error?.message);
        }
    };

    impersonateOrganization = async (req: Request, res: Response): Promise<void> => {
        try {
            const actor = (req as any).user as { userId: number; email: string; role: UserRole } | undefined;
            if (!actor?.userId) {
                ResponseUtil.unauthorized(res, 'Authentication required');
                return;
            }
            if (actor.role !== UserRole.SUPER_ADMIN) {
                ResponseUtil.forbidden(res, 'Super Admin privileges required');
                return;
            }

            const orgId = this.parseInt(req.params.orgId);
            if (!orgId) {
                ResponseUtil.badRequest(res, 'Invalid organization id');
                return;
            }

            const organization = await AppDataSource.getRepository(Organization).findOne({
                where: { id: orgId },
                select: ['id', 'name', 'code', 'type'],
            });
            if (!organization) {
                ResponseUtil.notFound(res, 'Organization not found');
                return;
            }

            const facilityId = this.parseInt(req.body?.facility_id ?? req.body?.facilityId ?? req.query?.facility_id);
            if (facilityId) {
                const facility = await AppDataSource.getRepository(Facility).findOne({
                    where: { id: facilityId },
                    select: ['id', 'organization_id', 'name'],
                });
                if (!facility || facility.organization_id !== orgId) {
                    ResponseUtil.forbidden(res, 'Facility does not belong to this organization');
                    return;
                }
            }

            const tokens = JwtUtil.generateTokenPair({
                userId: actor.userId,
                email: actor.email,
                role: UserRole.SUPER_ADMIN,
                organizationId: orgId,
                facilityId: facilityId ?? undefined,
            });

            await this.auditService.log({
                user_id: actor.userId,
                organization_id: orgId,
                action: AuditAction.IMPERSONATE,
                entity_type: AuditEntityType.ORGANIZATION,
                entity_id: orgId,
                description: `Impersonated organization (orgId=${orgId})`,
                new_values: { facility_id: facilityId ?? null },
                ip_address: req.ip,
                user_agent: String(req.headers['user-agent'] || ''),
            });

            ResponseUtil.success(
                res,
                {
                    tokens,
                    context: {
                        organizationId: orgId,
                        organization,
                        facilityId: facilityId ?? null,
                    },
                },
                'Impersonation token issued successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to impersonate organization', error?.message);
        }
    };
}
