import type { Alert } from '../types/pharmacy';

export type AlertScope = 'all' | 'inventory' | 'expiry' | 'operations';

export interface AlertActionTarget {
    label: string;
    to: string;
    search?: Record<string, string>;
    description: string;
}

export function isExpiryAlertType(type?: string): boolean {
    return type === 'expiry' || type === 'expiry_soon' || type === 'expired';
}

export function isInventoryAlertType(type?: string): boolean {
    return type === 'low_stock' || type === 'controlled_drug_threshold';
}

export function isOperationalAlertType(type?: string): boolean {
    return (
        type === 'batch_recall' ||
        type === 'stock_variance' ||
        type === 'reorder_suggestion' ||
        type === 'cold_chain_excursion'
    );
}

export function getAlertScope(type?: string): AlertScope {
    if (isExpiryAlertType(type)) return 'expiry';
    if (isOperationalAlertType(type)) return 'operations';
    if (isInventoryAlertType(type)) return 'inventory';
    return 'all';
}

export function getAlertTypeLabel(type?: string): string {
    switch (type) {
        case 'low_stock':
            return 'Low Stock';
        case 'expiry_soon':
            return 'Expiring Soon';
        case 'expired':
            return 'Expired';
        case 'controlled_drug_threshold':
            return 'Controlled Threshold';
        case 'reorder_suggestion':
            return 'Reorder Suggestion';
        case 'batch_recall':
            return 'Batch Recall';
        case 'stock_variance':
            return 'Stock Variance';
        case 'cold_chain_excursion':
            return 'Cold Chain Excursion';
        default:
            return 'Alert';
    }
}

export function getAlertSeverityLabel(severity?: string): string {
    switch (severity) {
        case 'out_of_stock':
            return 'Out of Stock';
        case 'critical':
            return 'Critical';
        case 'warning':
            return 'Warning';
        case 'info':
            return 'Info';
        default:
            return 'Alert';
    }
}

export function getAlertSeverityTone(severity?: string): string {
    switch (severity) {
        case 'out_of_stock':
            return 'bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40';
        case 'critical':
            return 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/40';
        case 'warning':
            return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/40';
        default:
            return 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/40';
    }
}

export function getAlertAccentTone(severity?: string): string {
    switch (severity) {
        case 'out_of_stock':
            return 'border-l-rose-700';
        case 'critical':
            return 'border-l-rose-500';
        case 'warning':
            return 'border-l-amber-500';
        default:
            return 'border-l-sky-400';
    }
}

export function getAlertSortWeight(alert: Alert): number {
    if (alert.severity === 'out_of_stock') return 0;
    if (alert.severity === 'critical') return 1;
    if (alert.severity === 'warning') return 2;
    return 3;
}

export function getAlertReferenceText(alert: Alert): string | null {
    if (alert.batch?.batch_number && alert.medicine?.name) {
        return `${alert.medicine.name} • Batch ${alert.batch.batch_number}`;
    }

    if (alert.medicine?.name) {
        return alert.medicine.name;
    }

    if (alert.reference_type && alert.reference_id) {
        return `${alert.reference_type.replace(/_/g, ' ')} #${alert.reference_id}`;
    }

    return null;
}

export function getAlertActionTarget(alert: Alert): AlertActionTarget | null {
    switch (alert.type) {
        case 'batch_recall':
            return {
                label: 'Open Recall Workspace',
                to: '/app/recalls',
                description: 'Review the active recall workflow, affected batches, and recall actions.',
            };
        case 'stock_variance':
            return {
                label: 'Open Variance Queue',
                to: '/app/variances',
                description: 'Approve, reject, or investigate the recorded stock discrepancy.',
            };
        case 'reorder_suggestion':
            return {
                label: 'Open replenishment',
                to: '/app/replenish',
                description: 'Review suggestions and generate draft purchase orders.',
            };
        case 'expiry_soon':
        case 'expired':
            return {
                label: 'Open Expiry Workspace',
                to: '/app/recalls',
                description: 'Review expiry actions, quarantine decisions, and near-expiry stock handling.',
            };
        case 'low_stock':
        case 'controlled_drug_threshold':
            return alert.medicine_id
                ? {
                      label: 'Open inventory',
                      to: '/app/inventory',
                      description: 'Find the medicine in inventory and open its detail drawer from the list.',
                  }
                : {
                      label: 'Open Stock Workspace',
                      to: '/app/stock',
                      description: 'Review current stock levels and batch inventory context.',
                  };
        default:
            return null;
    }
}
