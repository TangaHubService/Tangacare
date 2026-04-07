import { Request, Response } from 'express';
import { ResponseUtil } from '../../utils/response.util';
import { AdminBillingService } from '../../services/admin/admin-billing.service';
import {
    ChangeSubscriptionPlanDto,
    CreatePlanDto,
    ExtendTrialDto,
    UpdateGatewayDto,
    UpdateSubscriptionStatusDto,
} from '../../dto/admin-billing.dto';
import { AuditService } from '../../services/pharmacy/audit.service';
import { AuditAction, AuditEntityType } from '../../entities/AuditLog.entity';

export class AdminBillingController {
    private service: AdminBillingService;
    private auditService: AuditService;

    constructor() {
        this.service = new AdminBillingService();
        this.auditService = new AuditService();
    }

    private async logAdminAction(req: Request, input: {
        action: AuditAction;
        description: string;
        organization_id?: number;
        entity_id?: number;
        old_values?: Record<string, any>;
        new_values?: Record<string, any>;
    }) {
        const actor = (req as any).user as { userId?: number } | undefined;
        if (!actor?.userId) return;

        await this.auditService.log({
            user_id: actor.userId,
            organization_id: input.organization_id,
            action: input.action,
            entity_type: AuditEntityType.ORGANIZATION,
            entity_id: input.entity_id ?? input.organization_id,
            description: input.description,
            old_values: input.old_values,
            new_values: input.new_values,
            ip_address: req.ip,
            user_agent: String(req.headers['user-agent'] || ''),
        });
    }

    overview = async (_req: Request, res: Response) => {
        try {
            const result = await this.service.getBillingOverview();
            ResponseUtil.success(res, result, 'Billing overview retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve billing overview', error?.message);
        }
    };

    customers = async (req: Request, res: Response) => {
        try {
            const result = await this.service.getAllCustomersBillingStatus({
                search: req.query.search as string | undefined,
                plan: req.query.plan as string | undefined,
                status: req.query.status as string | undefined,
                page: Number(req.query.page || 1),
                limit: Math.min(Number(req.query.limit || 20), 100),
            });
            ResponseUtil.success(res, result, 'Customer billing status retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve customer billing status', error?.message);
        }
    };

    customerByOrganization = async (req: Request, res: Response) => {
        try {
            const orgId = Number(req.params.organizationId);
            const result = await this.service.getCustomerBillingStatus(orgId);
            ResponseUtil.success(res, result, 'Customer billing detail retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve customer billing detail', error?.message);
        }
    };

    subscriptions = async (req: Request, res: Response) => {
        try {
            const result = await this.service.getAllSubscriptions(req.query);
            ResponseUtil.success(res, result, 'Subscriptions retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve subscriptions', error?.message);
        }
    };

    subscriptionById = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const result = await this.service.getSubscriptionById(id);
            ResponseUtil.success(res, result, 'Subscription retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve subscription', error?.message);
        }
    };

    updateSubscriptionStatus = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const body = req.body as UpdateSubscriptionStatusDto;
            const current = await this.service.getSubscriptionById(id);
            const result = await this.service.updateSubscriptionStatus(id, body.status);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Updated subscription status for subscription ${id}`,
                organization_id: current?.organization_id,
                old_values: { status: current?.status },
                new_values: { status: body.status },
            });
            ResponseUtil.success(res, result, 'Subscription status updated');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update subscription status', error?.message);
        }
    };

    extendTrial = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const body = req.body as ExtendTrialDto;
            const current = await this.service.getSubscriptionById(id);
            const result = await this.service.extendTrial(id, body.days);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Extended trial for subscription ${id} by ${body.days} day(s)`,
                organization_id: current?.organization_id,
                old_values: { trial_end_at: current?.trial_end_at },
                new_values: { trial_end_at: result?.trial_end_at, days: body.days },
            });
            ResponseUtil.success(res, result, 'Trial extended successfully');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to extend trial', error?.message);
        }
    };

    changePlan = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const body = req.body as ChangeSubscriptionPlanDto;
            const current = await this.service.getSubscriptionById(id);
            const result = await this.service.changeSubscriptionPlan(id, body.to_plan_id, body.effective_mode);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Changed subscription plan for subscription ${id} (${body.effective_mode})`,
                organization_id: current?.organization_id,
                old_values: { subscription_plan_id: current?.subscription_plan_id },
                new_values: { to_plan_id: body.to_plan_id, effective_mode: body.effective_mode },
            });
            ResponseUtil.success(res, result, 'Subscription plan change scheduled');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to change subscription plan', error?.message);
        }
    };

    cancelPendingPlanChange = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const current = await this.service.getSubscriptionById(id);
            const result = await this.service.cancelPendingSubscriptionPlanChange(id);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Cancelled pending plan change for subscription ${id}`,
                organization_id: current?.organization_id,
                old_values: {
                    pending_plan_change: {
                        id: result?.id,
                        from_plan_id: result?.from_plan_id,
                        to_plan_id: result?.to_plan_id,
                        effective_date: result?.effective_date,
                        status: 'pending',
                    },
                },
                new_values: {
                    pending_plan_change: {
                        id: result?.id,
                        status: result?.status,
                    },
                },
            });
            ResponseUtil.success(res, result, 'Pending plan change cancelled');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to cancel pending plan change', error?.message);
        }
    };

    payments = async (req: Request, res: Response) => {
        try {
            const result = await this.service.getAllPayments(req.query);
            ResponseUtil.success(res, result, 'Payments retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve payments', error?.message);
        }
    };

    paymentById = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const result = await this.service.getPaymentById(id);
            ResponseUtil.success(res, result, 'Payment retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve payment', error?.message);
        }
    };

    trials = async (_req: Request, res: Response) => {
        try {
            const result = await this.service.getTrialSubscriptions();
            ResponseUtil.success(res, result, 'Trial subscriptions retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve trial subscriptions', error?.message);
        }
    };

    plans = async (_req: Request, res: Response) => {
        try {
            const result = await this.service.getPlanList();
            ResponseUtil.success(res, result, 'Plans retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve plans', error?.message);
        }
    };

    createPlan = async (req: Request, res: Response) => {
        try {
            const body = req.body as CreatePlanDto;
            const result = await this.service.createPlan(body);
            await this.logAdminAction(req, {
                action: AuditAction.CREATE,
                description: `Created billing plan ${result?.name || body.name}`,
                entity_id: result?.id,
                new_values: body as any,
            });
            ResponseUtil.created(res, result, 'Plan created');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to create plan', error?.message);
        }
    };

    updatePlan = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const body = req.body as Partial<CreatePlanDto>;
            const current = (await this.service.getPlanList()).find((p: any) => p.id === id);
            const result = await this.service.updatePlan(id, body);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Updated billing plan ${id}`,
                entity_id: id,
                old_values: current as any,
                new_values: body as any,
            });
            ResponseUtil.success(res, result, 'Plan updated');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update plan', error?.message);
        }
    };

    planFeatures = async (req: Request, res: Response) => {
        try {
            const planId = Number(req.params.id);
            const result = await this.service.getPlanFeatures(planId);
            ResponseUtil.success(res, result, 'Plan features retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve plan features', error?.message);
        }
    };

    updatePlanFeatures = async (req: Request, res: Response) => {
        try {
            const planId = Number(req.params.id);
            const current = await this.service.getPlanFeatures(planId);
            const result = await this.service.updatePlanFeatures(planId, req.body?.features || []);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Updated plan features for plan ${planId}`,
                entity_id: planId,
                old_values: { features: current },
                new_values: { features: req.body?.features || [] },
            });
            ResponseUtil.success(res, result, 'Plan features updated');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update plan features', error?.message);
        }
    };

    gateways = async (_req: Request, res: Response) => {
        try {
            const result = await this.service.getPaymentGatewaySettings();
            ResponseUtil.success(res, result, 'Payment gateways retrieved');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to retrieve payment gateways', error?.message);
        }
    };

    updateGateway = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);
            const body = req.body as UpdateGatewayDto;
            const oldList = await this.service.getPaymentGatewaySettings();
            const oldItem = oldList.find((g: any) => g.id === id);
            const result = await this.service.updatePaymentGatewaySettings(id, body);
            await this.logAdminAction(req, {
                action: AuditAction.UPDATE,
                description: `Updated payment gateway ${id}`,
                entity_id: id,
                old_values: oldItem as any,
                new_values: body as any,
            });
            ResponseUtil.success(res, result, 'Payment gateway updated');
        } catch (error: any) {
            ResponseUtil.internalError(res, 'Failed to update payment gateway', error?.message);
        }
    };
}

