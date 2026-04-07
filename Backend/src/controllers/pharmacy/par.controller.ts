import { Request, Response } from 'express';
import { ResponseUtil } from '../../utils/response.util';
import { resolveFacilityId } from '../../utils/request.util';
import { ParService } from '../../services/pharmacy/par.service';
import { ParReplenishmentPriority, ParReplenishmentTaskStatus } from '../../entities/ParLevel.entity';

export class ParController {
    private parService: ParService;

    constructor() {
        this.parService = new ParService();
    }

    private getAuthenticatedUserId(req: Request): number {
        return Number((req as any).user?.userId || (req as any).user?.id || 0);
    }

    upsertDepartmentLevels = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const departmentId = Number(req.params.departmentId);
            if (!Number.isInteger(departmentId) || departmentId <= 0) {
                ResponseUtil.badRequest(res, 'departmentId must be a positive integer');
                return;
            }

            const levels = Array.isArray(req.body?.levels) ? req.body.levels : [];
            const userId = this.getAuthenticatedUserId(req);
            if (!Number.isInteger(userId) || userId <= 0) {
                ResponseUtil.badRequest(res, 'Authenticated user is required');
                return;
            }

            const result = await this.parService.upsertParLevels(facilityId, departmentId, levels, userId);
            ResponseUtil.success(res, result, 'PAR levels updated successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update PAR levels', error.message);
        }
    };

    getDashboard = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const departmentId = req.query.department_id ? Number(req.query.department_id) : undefined;
            if (departmentId !== undefined && (!Number.isInteger(departmentId) || departmentId <= 0)) {
                ResponseUtil.badRequest(res, 'department_id must be a positive integer');
                return;
            }

            const data = await this.parService.getParDashboard(facilityId, departmentId);
            ResponseUtil.success(res, data, 'PAR dashboard retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve PAR dashboard', error.message);
        }
    };

    generateTasks = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const userId = this.getAuthenticatedUserId(req);
            if (!Number.isInteger(userId) || userId <= 0) {
                ResponseUtil.badRequest(res, 'Authenticated user is required');
                return;
            }

            const departmentId =
                req.body?.department_id !== undefined ? Number(req.body.department_id) : undefined;
            if (departmentId !== undefined && (!Number.isInteger(departmentId) || departmentId <= 0)) {
                ResponseUtil.badRequest(res, 'department_id must be a positive integer');
                return;
            }

            const result = await this.parService.generateReplenishmentTasks(facilityId, userId, departmentId);
            ResponseUtil.success(res, result, 'PAR replenishment tasks generated successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to generate PAR tasks', error.message);
        }
    };

    listTasks = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const status = req.query.status as ParReplenishmentTaskStatus | undefined;
            const priority = req.query.priority as ParReplenishmentPriority | undefined;
            const departmentId = req.query.department_id ? Number(req.query.department_id) : undefined;

            if (
                status &&
                !Object.values(ParReplenishmentTaskStatus).includes(status as ParReplenishmentTaskStatus)
            ) {
                ResponseUtil.badRequest(res, 'Invalid status filter');
                return;
            }

            if (priority && !Object.values(ParReplenishmentPriority).includes(priority as ParReplenishmentPriority)) {
                ResponseUtil.badRequest(res, 'Invalid priority filter');
                return;
            }

            if (departmentId !== undefined && (!Number.isInteger(departmentId) || departmentId <= 0)) {
                ResponseUtil.badRequest(res, 'department_id must be a positive integer');
                return;
            }

            const result = await this.parService.getTasks(facilityId, {
                status,
                priority,
                department_id: departmentId,
            });
            ResponseUtil.success(res, result, 'PAR tasks retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve PAR tasks', error.message);
        }
    };

    updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const taskId = Number(req.params.taskId);
            if (!Number.isInteger(taskId) || taskId <= 0) {
                ResponseUtil.badRequest(res, 'taskId must be a positive integer');
                return;
            }

            const status = req.body?.status as ParReplenishmentTaskStatus;
            if (!Object.values(ParReplenishmentTaskStatus).includes(status)) {
                ResponseUtil.badRequest(res, 'Invalid task status');
                return;
            }

            const userId = this.getAuthenticatedUserId(req);
            if (!Number.isInteger(userId) || userId <= 0) {
                ResponseUtil.badRequest(res, 'Authenticated user is required');
                return;
            }

            const notes = req.body?.notes ? String(req.body.notes) : undefined;
            const task = await this.parService.updateTaskStatus(taskId, facilityId, status, userId, notes);
            ResponseUtil.success(res, task, 'PAR task status updated successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update PAR task status', error.message);
        }
    };
}
