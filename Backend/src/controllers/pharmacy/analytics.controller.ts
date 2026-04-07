import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { AnalyticsService } from '../../services/pharmacy/analytics.service';
import { ConsumptionService } from '../../services/pharmacy/consumption.service';
import { ReportingService } from '../../services/pharmacy/reporting.service';
import { SupplierPerformanceService } from '../../services/pharmacy/supplier-performance.service';
import { IntelligenceService } from '../../services/pharmacy/intelligence.service';
import { ReplenishmentService } from '../../services/pharmacy/replenishment.service';
import { ResponseUtil } from '../../utils/response.util';
import { Medicine } from '../../entities/Medicine.entity';
import { PhysicalCount, PhysicalCountStatus } from '../../entities/PhysicalCount.entity';
import { resolveFacilityId, resolveOrganizationId } from '../../utils/request.util';

export class AnalyticsController {
    private analyticsService: AnalyticsService;
    private consumptionService: ConsumptionService;
    private reportingService: ReportingService;
    private intelligenceService: IntelligenceService;
    private supplierPerformanceService: SupplierPerformanceService;
    private replenishmentService: ReplenishmentService;

    constructor() {
        this.analyticsService = new AnalyticsService();
        this.consumptionService = new ConsumptionService();
        this.reportingService = new ReportingService();
        this.intelligenceService = new IntelligenceService();
        this.supplierPerformanceService = new SupplierPerformanceService();
        this.replenishmentService = new ReplenishmentService();
    }

    /**
     * GET /pharmacy/analytics/kpis
     * Get advanced KPIs (inventory turnover, DOH, accuracy, controlled drug variance)
     */
    getAdvancedKPIs = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            // Calculate inventory turnover for last 90 days
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 90);

            const inventoryTurnover = await this.analyticsService.calculateInventoryTurnover(
                facilityId,
                organizationId,
                startDate,
                endDate,
            );

            // Calculate average days on hand
            const dohResults = await this.analyticsService.calculateDaysOnHand(facilityId, organizationId);
            const avgDOH =
                dohResults.length > 0
                    ? dohResults.reduce((sum: number, item: any) => sum + item.doh, 0) / dohResults.length
                    : 0;
            const criticalDOH = dohResults.filter((item: any) => item.doh < 7).length;

            // Get inventory accuracy from the most recent approved/completed physical count
            const physicalCountRepository = AppDataSource.getRepository(PhysicalCount);
            const latestPhysicalCount = await physicalCountRepository
                .createQueryBuilder('count')
                .leftJoinAndSelect('count.items', 'items')
                .where('count.facility_id = :facilityId', { facilityId })
                .andWhere('count.status IN (:...statuses)', {
                    statuses: [PhysicalCountStatus.APPROVED, PhysicalCountStatus.COMPLETED],
                })
                .orderBy('COALESCE(count.approved_at, count.updated_at, count.created_at)', 'DESC')
                .addOrderBy('count.id', 'DESC')
                .getOne();

            const inventoryAccuracy = {
                rate: (() => {
                    if (!latestPhysicalCount?.items?.length) return 0;
                    const totalSystemQty = latestPhysicalCount.items.reduce(
                        (sum, item) => sum + Math.max(0, Number(item.system_quantity || 0)),
                        0,
                    );
                    const totalAbsoluteVariance = latestPhysicalCount.items.reduce(
                        (sum, item) => sum + Math.abs(Number(item.variance || 0)),
                        0,
                    );
                    if (totalSystemQty <= 0) return 100;
                    const rate = ((totalSystemQty - totalAbsoluteVariance) / totalSystemQty) * 100;
                    return Math.max(0, Math.round(rate * 100) / 100);
                })(),
                last_count_date: latestPhysicalCount?.count_date
                    ? new Date(latestPhysicalCount.count_date).toISOString()
                    : null,
                target: 97,
            };

            // Calculate controlled drug variance
            const controlledDrugVariance = await this.analyticsService.calculateControlledDrugVariance(
                facilityId,
                organizationId,
            );
            const hasVariance = controlledDrugVariance.some((item: any) => item.variance !== 0);

            const data = {
                inventory_turnover: {
                    ratio: inventoryTurnover.turnover_ratio,
                    period: '90 days',
                    target: 4.0,
                },
                days_on_hand: {
                    average: Math.round(avgDOH * 10) / 10,
                    critical_items: criticalDOH,
                    target: 60,
                },
                inventory_accuracy: inventoryAccuracy,
                controlled_drug_variance: {
                    status: hasVariance ? 'variance' : 'compliant',
                    variance_count: controlledDrugVariance.filter((item: any) => item.variance !== 0).length,
                },
            };

            ResponseUtil.success(res, data, 'Advanced KPIs retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve advanced KPIs', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/critical-medicines
     * Get critical medicines with current status
     */
    getCriticalMedicines = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const organizationId = resolveOrganizationId(req);

            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const medicineRepo = AppDataSource.getRepository(Medicine);
            const dispenseRepo = AppDataSource.getRepository(
                require('../../entities/DispenseTransaction.entity').DispenseTransaction,
            );
            const batchRepo = AppDataSource.getRepository(require('../../entities/Batch.entity').Batch);

            const criticalMedicines = await medicineRepo
                .createQueryBuilder('medicine')
                .leftJoin(
                    'medicine.stocks',
                    'stock',
                    'stock.facility_id = :facilityId OR stock.organization_id = :organizationId',
                    {
                        facilityId,
                        organizationId,
                    },
                )
                .select('medicine.id', 'id')
                .addSelect('medicine.name', 'name')
                .addSelect('medicine.min_stock_level', 'min_threshold')
                .addSelect('COALESCE(SUM(stock.quantity), 0)', 'current_quantity')
                .where('medicine.is_critical_medicine = :isCritical', { isCritical: true })
                .andWhere('medicine.is_active = :isActive', { isActive: true })
                .andWhere('medicine.organization_id = :organizationId', { organizationId })
                .groupBy('medicine.id')
                .addGroupBy('medicine.name')
                .addGroupBy('medicine.min_stock_level')
                .getRawMany();

            const medicines = await Promise.all(
                criticalMedicines.map(async (med) => {
                    const currentQty = parseInt(med.current_quantity || '0', 10);
                    const minThreshold = med.min_threshold || 0;

                    let status: 'adequate' | 'low_stock' | 'critical';
                    if (currentQty === 0) {
                        status = 'critical';
                    } else if (currentQty <= minThreshold) {
                        status = 'low_stock';
                    } else {
                        status = 'adequate';
                    }

                    // Check expiry risk
                    const nearExpiryBatchesQuery = batchRepo
                        .createQueryBuilder('batch')
                        .leftJoin('batch.stocks', 'stock', 'stock.organization_id = :organizationId', {
                            organizationId,
                        })
                        .where('batch.medicine_id = :medicineId', { medicineId: med.id })
                        .andWhere('batch.expiry_date <= :thirtyDaysFromNow', {
                            thirtyDaysFromNow: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        })
                        .andWhere('stock.quantity > 0')
                        .andWhere('batch.organization_id = :organizationId', { organizationId });

                    if (facilityId) {
                        nearExpiryBatchesQuery.andWhere('stock.facility_id = :facilityId', { facilityId });
                    }

                    const nearExpiryBatches = await nearExpiryBatchesQuery.getCount();

                    let expiryRisk: 'safe' | 'warning' | 'critical';
                    if (nearExpiryBatches > 0) {
                        expiryRisk = 'warning';
                    } else {
                        expiryRisk = 'safe';
                    }

                    // Get last dispensed date
                    const lastDispenseQuery = dispenseRepo
                        .createQueryBuilder('dispense')
                        .where('dispense.medicine_id = :medicineId', { medicineId: med.id })
                        .andWhere('dispense.organization_id = :organizationId', { organizationId })
                        .orderBy('dispense.created_at', 'DESC');

                    if (facilityId) {
                        lastDispenseQuery.andWhere('dispense.facility_id = :facilityId', { facilityId });
                    }

                    const lastDispense = await lastDispenseQuery.getOne();

                    return {
                        id: med.id,
                        name: med.name,
                        current_quantity: currentQty,
                        min_threshold: minThreshold,
                        status,
                        expiry_risk: expiryRisk,
                        last_dispensed: lastDispense?.created_at?.toISOString() || null,
                    };
                }),
            );

            ResponseUtil.success(res, { medicines }, 'Critical medicines retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve critical medicines', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/expiry-heatmap
     * Get expiry heat map for calendar view
     */
    getExpiryHeatMap = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const startDate = req.query.start ? new Date(req.query.start as string) : new Date();
            const endDate = req.query.end
                ? new Date(req.query.end as string)
                : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

            if (req.query.end) {
                endDate.setHours(23, 59, 59, 999);
            }

            const heatMapData = await this.reportingService.getExpiryHeatMap(
                facilityId,
                organizationId,
                startDate,
                endDate,
            );

            ResponseUtil.success(res, heatMapData, 'Expiry heat map retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve expiry heat map', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/fefo-compliance
     * Get FEFO compliance rate
     */
    getFEFOCompliance = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const nearExpiryDays = req.query.days ? parseInt(req.query.days as string, 10) : 30;

            const fefoCompliance = await this.reportingService.getFEFOCompliance(
                facilityId,
                organizationId,
                nearExpiryDays,
            );

            ResponseUtil.success(res, fefoCompliance, 'FEFO compliance retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve FEFO compliance', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/abc-analysis
     * Get ABC analysis of medicines
     */
    getABCAnalysis = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            // ABC Analysis for all time (can be adjusted by query param if needed)

            const data = await this.reportingService.getABCAnalysis(facilityId, organizationId);

            ResponseUtil.success(res, data, 'ABC analysis retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve ABC analysis', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/multi-location
     * Get multi-location comparison
     */
    getMultiLocationComparison = async (req: Request, res: Response): Promise<void> => {
        try {
            const user = (req as any).user;
            const organizationId: number | undefined = user?.organizationId;

            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const metric = (req.query.metric as string) || 'inventory_value';

            const comparison = await this.reportingService.getMultiLocationComparison(organizationId, metric);

            ResponseUtil.success(res, comparison, 'Multi-location comparison retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve multi-location comparison', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/overstock
     * Get overstock report
     */
    getOverstockReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const overstockData = await this.reportingService.getOverstockReport(facilityId, organizationId);

            ResponseUtil.success(res, overstockData, 'Overstock report retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve overstock report', error.message);
        }
    };

    /**
     * POST /pharmacy/analytics/recalculate-consumption
     * Recalculate average daily consumption for all medicines
     */
    recalculateConsumption = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const days = req.body.days || 90;
            const organizationId = (req as any).user?.organizationId;

            const results = await this.consumptionService.recalculateAllConsumption(organizationId, facilityId, days);

            ResponseUtil.success(
                res,
                { updated_count: results.length, results },
                'Consumption recalculated successfully',
            );
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to recalculate consumption', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/reorder-suggestions
     * Get medicines below reorder point
     */
    getReorderSuggestions = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            const user = (req as any).user;
            const role = String(user?.role || '').toLowerCase();
            const isHighLevel = role === 'super_admin' || role === 'owner' || role === 'admin';

            if (!facilityId && !isHighLevel) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = user?.organizationId;
            const suggestions = await this.replenishmentService.getSuggestions(organizationId, facilityId);

            ResponseUtil.success(res, { suggestions }, 'Reorder suggestions retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve reorder suggestions', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/supplier-performance
     * Get supplier performance metrics
     */
    getSupplierPerformance = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);

            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const performance = await this.supplierPerformanceService.getAggregatedForOrganization(
                facilityId,
                organizationId,
            );

            ResponseUtil.success(res, performance, 'Supplier performance retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve supplier performance', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/velocity-segmentation
     * Classify medicines into fast/medium/slow/dead segments.
     */
    getVelocitySegmentation = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const days = req.query.days ? Number(req.query.days) : 90;
            const result = await this.intelligenceService.getVelocitySegmentation(
                facilityId,
                organizationId,
                days,
            );
            ResponseUtil.success(res, result, 'Velocity segmentation retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve velocity segmentation', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/supplier-intelligence
     * OTIF/fill-rate/variance intelligence for suppliers.
     */
    getSupplierIntelligence = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const startDate = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
            const endDate = req.query.end_date ? new Date(req.query.end_date as string) : undefined;
            if (endDate) {
                endDate.setHours(23, 59, 59, 999);
            }

            const result = await this.intelligenceService.getSupplierIntelligence(
                facilityId,
                organizationId,
                startDate,
                endDate,
            );
            ResponseUtil.success(res, result, 'Supplier intelligence retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve supplier intelligence', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/near-expiry-actions
     * Actionable near-expiry automation plan.
     */
    getNearExpiryActions = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const horizonDays = req.query.horizon_days ? Number(req.query.horizon_days) : 90;
            const result = await this.intelligenceService.getNearExpiryActionPlan(
                facilityId,
                organizationId,
                horizonDays,
            );
            ResponseUtil.success(res, result, 'Near-expiry action plan retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve near-expiry action plan', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/demand-forecast
     * Forecast demand with trend + seasonality baseline.
     */
    getDemandForecast = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const horizonDays = req.query.horizon_days ? Number(req.query.horizon_days) : 30;
            const historyDays = req.query.history_days ? Number(req.query.history_days) : 180;
            const result = await this.intelligenceService.getDemandForecast(
                facilityId,
                organizationId,
                horizonDays,
                historyDays,
            );
            ResponseUtil.success(res, result, 'Demand forecast retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve demand forecast', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/smart-reorder
     * Multi-factor reorder recommendations.
     */
    getSmartReorderPlan = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const horizonDays = req.query.horizon_days ? Number(req.query.horizon_days) : 30;
            const result = await this.intelligenceService.getSmartReorderPlan(
                facilityId,
                organizationId,
                horizonDays,
            );
            ResponseUtil.success(res, result, 'Smart reorder plan retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve smart reorder plan', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/predictive-expiry
     * Predict expiry write-off risk by batch.
     */
    getPredictiveExpiry = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const horizonDays = req.query.horizon_days ? Number(req.query.horizon_days) : 120;
            const result = await this.intelligenceService.getPredictiveExpiryRisk(
                facilityId,
                organizationId,
                horizonDays,
                90,
            );
            ResponseUtil.success(res, result, 'Predictive expiry analytics retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve predictive expiry analytics', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/multi-branch-transfer
     * Suggest cross-facility stock balancing transfers.
     */
    getMultiBranchTransferSuggestions = async (req: Request, res: Response): Promise<void> => {
        try {
            const organizationId =
                resolveOrganizationId(req) ||
                Number((req as any).user?.organizationId || (req as any).user?.organization_id || 0);
            if (!organizationId) {
                ResponseUtil.badRequest(res, 'Organization ID is required');
                return;
            }

            const lookbackDays = req.query.lookback_days ? Number(req.query.lookback_days) : 60;
            const result = await this.intelligenceService.getMultiBranchTransferSuggestions(organizationId, lookbackDays);
            ResponseUtil.success(res, result, 'Multi-branch transfer suggestions retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve multi-branch transfer suggestions', error.message);
        }
    };

    /**
     * GET /pharmacy/analytics/mobile-workflow-board
     * Compact action board optimized for mobile execution.
     */
    getMobileWorkflowBoard = async (req: Request, res: Response): Promise<void> => {
        try {
            const facilityId = resolveFacilityId(req);
            if (!facilityId) {
                ResponseUtil.badRequest(res, 'Facility ID is required');
                return;
            }

            const organizationId = resolveOrganizationId(req);
            const result = await this.intelligenceService.getMobileWorkflowBoard(facilityId, organizationId);
            ResponseUtil.success(res, result, 'Mobile workflow board retrieved successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve mobile workflow board', error.message);
        }
    };
}
