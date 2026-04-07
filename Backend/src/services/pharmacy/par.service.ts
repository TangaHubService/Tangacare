import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { Department } from '../../entities/Department.entity';
import { Medicine } from '../../entities/Medicine.entity';
import { Stock } from '../../entities/Stock.entity';
import {
    DepartmentParLevel,
    ParReplenishmentPriority,
    ParReplenishmentTask,
    ParReplenishmentTaskStatus,
} from '../../entities/ParLevel.entity';

export interface UpsertParLevelInput {
    medicine_id: number;
    par_level: number;
    min_level?: number;
    refill_to_level?: number;
    is_active?: boolean;
}

export interface ParDashboardItem {
    department_id: number;
    department_name: string;
    medicine_id: number;
    medicine_name: string;
    current_quantity: number;
    par_level: number;
    min_level: number;
    refill_to_level: number;
    gap_to_target: number;
    compliance: 'compliant' | 'below_min' | 'out_of_stock';
    priority: ParReplenishmentPriority;
}

export class ParService {
    private parLevelRepository: Repository<DepartmentParLevel>;
    private taskRepository: Repository<ParReplenishmentTask>;
    private stockRepository: Repository<Stock>;
    private departmentRepository: Repository<Department>;
    private medicineRepository: Repository<Medicine>;

    constructor() {
        this.parLevelRepository = AppDataSource.getRepository(DepartmentParLevel);
        this.taskRepository = AppDataSource.getRepository(ParReplenishmentTask);
        this.stockRepository = AppDataSource.getRepository(Stock);
        this.departmentRepository = AppDataSource.getRepository(Department);
        this.medicineRepository = AppDataSource.getRepository(Medicine);
    }

    async upsertParLevels(
        facilityId: number,
        departmentId: number,
        levels: UpsertParLevelInput[],
        userId: number,
    ): Promise<DepartmentParLevel[]> {
        if (!Array.isArray(levels) || levels.length === 0) {
            throw new AppError('At least one PAR level is required', 400);
        }

        const department = await this.departmentRepository.findOne({
            where: { id: departmentId, facility_id: facilityId },
        });
        if (!department) {
            throw new AppError('Department not found in this facility', 404);
        }

        const medicineIds = Array.from(new Set(levels.map((l) => l.medicine_id)));
        const medicineCount = await this.medicineRepository
            .createQueryBuilder('medicine')
            .where('medicine.id IN (:...medicineIds)', { medicineIds })
            .getCount();
        if (medicineCount !== medicineIds.length) {
            throw new AppError('One or more medicines do not exist', 400);
        }

        const saved: DepartmentParLevel[] = [];

        for (const level of levels) {
            if (!Number.isInteger(level.par_level) || level.par_level <= 0) {
                throw new AppError(`Invalid par_level for medicine ${level.medicine_id}`, 400);
            }

            const minLevel = Math.max(0, Number(level.min_level ?? 0));
            const refillToLevel = Math.max(level.par_level, Number(level.refill_to_level ?? level.par_level));

            let existing = await this.parLevelRepository.findOne({
                where: {
                    facility_id: facilityId,
                    department_id: departmentId,
                    medicine_id: level.medicine_id,
                },
            });

            if (!existing) {
                existing = this.parLevelRepository.create({
                    facility_id: facilityId,
                    department_id: departmentId,
                    medicine_id: level.medicine_id,
                    par_level: level.par_level,
                    min_level: minLevel,
                    refill_to_level: refillToLevel,
                    is_active: level.is_active ?? true,
                    created_by_id: userId,
                });
            } else {
                existing.par_level = level.par_level;
                existing.min_level = minLevel;
                existing.refill_to_level = refillToLevel;
                existing.is_active = level.is_active ?? existing.is_active;
            }

            saved.push(await this.parLevelRepository.save(existing));
        }

        return saved;
    }

    async getParDashboard(
        facilityId: number,
        departmentId?: number,
    ): Promise<{
        summary: {
            tracked_items: number;
            compliant_items: number;
            below_min_items: number;
            out_of_stock_items: number;
            total_gap_quantity: number;
        };
        items: ParDashboardItem[];
    }> {
        const levelsQuery = this.parLevelRepository
            .createQueryBuilder('par')
            .leftJoinAndSelect('par.department', 'department')
            .leftJoinAndSelect('par.medicine', 'medicine')
            .where('par.facility_id = :facilityId', { facilityId })
            .andWhere('par.is_active = :isActive', { isActive: true });

        if (departmentId) {
            levelsQuery.andWhere('par.department_id = :departmentId', { departmentId });
        }

        const levels = await levelsQuery.getMany();
        if (levels.length === 0) {
            return {
                summary: {
                    tracked_items: 0,
                    compliant_items: 0,
                    below_min_items: 0,
                    out_of_stock_items: 0,
                    total_gap_quantity: 0,
                },
                items: [],
            };
        }

        const stockRows = await this.stockRepository
            .createQueryBuilder('stock')
            .select('stock.department_id', 'department_id')
            .addSelect('stock.medicine_id', 'medicine_id')
            .addSelect('COALESCE(SUM(stock.quantity - stock.reserved_quantity), 0)', 'qty')
            .where('stock.facility_id = :facilityId', { facilityId })
            .andWhere('stock.is_deleted = :isDeleted', { isDeleted: false })
            .groupBy('stock.department_id')
            .addGroupBy('stock.medicine_id')
            .getRawMany();

        const stockMap = new Map<string, number>();
        stockRows.forEach((row) => {
            const key = `${String(row.department_id)}:${String(row.medicine_id)}`;
            stockMap.set(key, Number(row.qty || 0));
        });

        const items: ParDashboardItem[] = levels.map((level) => {
            const key = `${String(level.department_id)}:${String(level.medicine_id)}`;
            const currentQuantity = stockMap.get(key) || 0;
            const minLevel = Number(level.min_level ?? level.par_level ?? 0);
            const refillToLevel = Number(level.refill_to_level ?? level.par_level ?? 0);
            const gapToTarget = Math.max(0, refillToLevel - currentQuantity);

            let compliance: ParDashboardItem['compliance'] = 'compliant';
            if (currentQuantity <= 0) compliance = 'out_of_stock';
            else if (currentQuantity < minLevel) compliance = 'below_min';

            let priority: ParReplenishmentPriority = ParReplenishmentPriority.LOW;
            if (currentQuantity <= 0) priority = ParReplenishmentPriority.CRITICAL;
            else if (currentQuantity < minLevel) priority = ParReplenishmentPriority.HIGH;
            else if (gapToTarget > 0) priority = ParReplenishmentPriority.MEDIUM;

            return {
                department_id: level.department_id,
                department_name: level.department?.name || 'Unknown',
                medicine_id: level.medicine_id,
                medicine_name: level.medicine?.name || 'Unknown',
                current_quantity: currentQuantity,
                par_level: Number(level.par_level || 0),
                min_level: minLevel,
                refill_to_level: refillToLevel,
                gap_to_target: gapToTarget,
                compliance,
                priority,
            };
        });

        return {
            summary: {
                tracked_items: items.length,
                compliant_items: items.filter((i) => i.compliance === 'compliant').length,
                below_min_items: items.filter((i) => i.compliance === 'below_min').length,
                out_of_stock_items: items.filter((i) => i.compliance === 'out_of_stock').length,
                total_gap_quantity: items.reduce((sum, item) => sum + item.gap_to_target, 0),
            },
            items,
        };
    }

    async generateReplenishmentTasks(
        facilityId: number,
        generatedById: number,
        departmentId?: number,
    ): Promise<{ created: number; updated: number; tasks: ParReplenishmentTask[] }> {
        const dashboard = await this.getParDashboard(facilityId, departmentId);
        const candidates = dashboard.items.filter((i) => i.gap_to_target > 0);
        if (candidates.length === 0) {
            return { created: 0, updated: 0, tasks: [] };
        }

        let created = 0;
        let updated = 0;
        const tasks: ParReplenishmentTask[] = [];

        for (const item of candidates) {
            const existing = await this.taskRepository.findOne({
                where: {
                    facility_id: facilityId,
                    department_id: item.department_id,
                    medicine_id: item.medicine_id,
                    status: ParReplenishmentTaskStatus.PENDING,
                },
            });

            const dueAt = new Date();
            if (item.priority === ParReplenishmentPriority.CRITICAL) {
                dueAt.setHours(dueAt.getHours() + 4);
            } else if (item.priority === ParReplenishmentPriority.HIGH) {
                dueAt.setHours(dueAt.getHours() + 12);
            } else {
                dueAt.setDate(dueAt.getDate() + 1);
            }

            if (existing) {
                existing.current_quantity = item.current_quantity;
                existing.target_quantity = item.refill_to_level;
                existing.suggested_quantity = item.gap_to_target;
                existing.priority = item.priority;
                existing.due_at = dueAt;
                existing.notes = `Auto-refreshed from PAR dashboard (${item.compliance})`;
                tasks.push(await this.taskRepository.save(existing));
                updated += 1;
                continue;
            }

            const task = this.taskRepository.create({
                facility_id: facilityId,
                department_id: item.department_id,
                medicine_id: item.medicine_id,
                current_quantity: item.current_quantity,
                target_quantity: item.refill_to_level,
                suggested_quantity: item.gap_to_target,
                priority: item.priority,
                status: ParReplenishmentTaskStatus.PENDING,
                generated_by_id: generatedById,
                due_at: dueAt,
                notes: `Generated from PAR dashboard (${item.compliance})`,
            });
            tasks.push(await this.taskRepository.save(task));
            created += 1;
        }

        return { created, updated, tasks };
    }

    async getTasks(
        facilityId: number,
        filters?: {
            status?: ParReplenishmentTaskStatus;
            department_id?: number;
            priority?: ParReplenishmentPriority;
        },
    ): Promise<ParReplenishmentTask[]> {
        const query = this.taskRepository
            .createQueryBuilder('task')
            .leftJoinAndSelect('task.department', 'department')
            .leftJoinAndSelect('task.medicine', 'medicine')
            .where('task.facility_id = :facilityId', { facilityId })
            .orderBy('task.created_at', 'DESC');

        if (filters?.status) {
            query.andWhere('task.status = :status', { status: filters.status });
        }
        if (filters?.department_id) {
            query.andWhere('task.department_id = :departmentId', { departmentId: filters.department_id });
        }
        if (filters?.priority) {
            query.andWhere('task.priority = :priority', { priority: filters.priority });
        }

        return query.getMany();
    }

    async updateTaskStatus(
        taskId: number,
        facilityId: number,
        status: ParReplenishmentTaskStatus,
        userId: number,
        notes?: string,
    ): Promise<ParReplenishmentTask> {
        const task = await this.taskRepository.findOne({
            where: { id: taskId, facility_id: facilityId },
        });
        if (!task) {
            throw new AppError('PAR task not found', 404);
        }

        task.status = status;
        if (notes) task.notes = notes;

        if (status === ParReplenishmentTaskStatus.COMPLETED) {
            task.completed_at = new Date();
            task.completed_by_id = userId;
        }

        return this.taskRepository.save(task);
    }
}
