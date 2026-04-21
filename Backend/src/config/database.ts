import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { User } from '../entities/User.entity';
import { Doctor } from '../entities/Doctor.entity';
import { Appointment } from '../entities/Appointment.entity';
import { Prescription } from '../entities/Prescription.entity';
import { Payment } from '../entities/Payment.entity';
import { HealthRecord } from '../entities/HealthRecord.entity';
import { HealthTip } from '../entities/HealthTip.entity';
import { DoctorReview } from '../entities/DoctorReview.entity';

import { Conversation } from '../entities/Conversation.entity';
import { Message } from '../entities/Message.entity';
import { MessageRead } from '../entities/MessageRead.entity';
import { Call } from '../entities/Call.entity';
import { Notification } from '../entities/Notification.entity';
import { AlertEvent } from '../entities/AlertEvent.entity';
import { AlertDeliveryLog } from '../entities/AlertDeliveryLog.entity';

import { Organization } from '../entities/Organization.entity';
import { Facility } from '../entities/Facility.entity';
import { MedicineCategory } from '../entities/MedicineCategory.entity';
import { Department } from '../entities/Department.entity';
import { Medicine } from '../entities/Medicine.entity';
import { Batch } from '../entities/Batch.entity';
import { Stock } from '../entities/Stock.entity';
import { Supplier } from '../entities/Supplier.entity';
import { PurchaseOrder, PurchaseOrderItem } from '../entities/PurchaseOrder.entity';
import { PurchaseOrderActivity } from '../entities/PurchaseOrderActivity.entity';
import { DispenseTransaction } from '../entities/DispenseTransaction.entity';
import { StockTransfer, StockTransferItem } from '../entities/StockTransfer.entity';
import { Alert } from '../entities/Alert.entity';
import { AuditLog } from '../entities/AuditLog.entity';
import { Sale, SaleItem, SalePayment } from '../entities/Sale.entity';
import { CreditNote } from '../entities/CreditNote.entity';
import { DebitNote } from '../entities/DebitNote.entity';
import { Service } from '../entities/Service.entity';
import { SupportTicket } from '../entities/SupportTicket.entity';
import { StockMovement } from '../entities/StockMovement.entity';
import { CustomerReturn, CustomerReturnItem } from '../entities/CustomerReturn.entity';
import { PhysicalCount, PhysicalCountItem } from '../entities/PhysicalCount.entity';
import { StorageLocation } from '../entities/StorageLocation.entity';
import { Invitation } from '../entities/Invitation.entity';
import { InsuranceProvider } from '../entities/InsuranceProvider.entity';
import { InsuranceClaim } from '../entities/InsuranceClaim.entity';
import { MedicineFacilitySetting } from '../entities/MedicineFacilitySetting.entity';
import { BatchRecall } from '../entities/BatchRecall.entity';
import { StockVariance } from '../entities/StockVariance.entity';
import { RefreshToken } from '../entities/RefreshToken.entity';
import { IdempotencyKey } from '../entities/IdempotencyKey.entity';
import { ColdChainTelemetry } from '../entities/ColdChainTelemetry.entity';
import { ColdChainExcursion } from '../entities/ColdChainExcursion.entity';
import { GoodsReceipt, GoodsReceiptItem } from '../entities/GoodsReceipt.entity';
import { FacilityMedicineConfig } from '../entities/FacilityMedicineConfig.entity';
import { PurchaseApprovalThreshold } from '../entities/PurchaseApprovalThreshold.entity';
import { DepartmentParLevel, ParReplenishmentTask } from '../entities/ParLevel.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { Subscription } from '../entities/Subscription.entity';
import { SubscriptionPayment } from '../entities/SubscriptionPayment.entity';
import { PaypackWebhookEvent } from '../entities/PaypackWebhookEvent.entity';
import { PlanFeature } from '../entities/PlanFeature.entity';
import { SubscriptionChangeSchedule } from '../entities/SubscriptionChangeSchedule.entity';
import { PaymentAttempt } from '../entities/PaymentAttempt.entity';
import { PaymentGateway } from '../entities/PaymentGateway.entity';
import { WebhookEvent } from '../entities/WebhookEvent.entity';
import { ReportExportJob } from '../entities/ReportExportJob.entity';
import { AuditSubscriber } from '../subscribers/AuditSubscriber';
import { StockMovementImmutabilitySubscriber } from '../subscribers/StockMovementImmutabilitySubscriber';
import { PurchasePriceHistory } from '../entities/PurchasePriceHistory.entity';
import { FiscalReceiptCounter } from '../entities/FiscalReceiptCounter.entity';

dotenv.config();
const sslEnabled = (process.env.DB_SSL || '').toLowerCase() === 'true';

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'tangacare',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
    entities: [
        User,
        Doctor,
        Appointment,
        Prescription,
        Payment,
        HealthRecord,
        HealthTip,
        DoctorReview,

        Conversation,
        Message,
        MessageRead,
        Call,
        Notification,
        AlertEvent,
        AlertDeliveryLog,

        Organization,
        Facility,
        MedicineCategory,
        Department,
        Medicine,
        Batch,
        Stock,
        Supplier,
        PurchaseOrder,
        PurchaseOrderItem,
        PurchaseOrderActivity,
        DispenseTransaction,
        StockTransfer,
        StockTransferItem,
        Alert,
        AuditLog,
        Sale,
        SaleItem,
        SalePayment,
        CreditNote,
        DebitNote,
        Service,
        SupportTicket,
        StockMovement,
        CustomerReturn,
        CustomerReturnItem,
        PhysicalCount,
        PhysicalCountItem,
        Invitation,
        StorageLocation,
        InsuranceProvider,
        InsuranceClaim,
        MedicineFacilitySetting,
        BatchRecall,
        StockVariance,
        RefreshToken,
        IdempotencyKey,
        ColdChainTelemetry,
        ColdChainExcursion,
        GoodsReceipt,
        GoodsReceiptItem,
        FacilityMedicineConfig,
        PurchaseApprovalThreshold,
        DepartmentParLevel,
        ParReplenishmentTask,
        PurchasePriceHistory,
        FiscalReceiptCounter,
        SubscriptionPlan,
        PlanFeature,
        Subscription,
        SubscriptionPayment,
        SubscriptionChangeSchedule,
        PaymentAttempt,
        PaymentGateway,
        PaypackWebhookEvent,
        WebhookEvent,
        ReportExportJob,
    ],
    migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
    subscribers: [AuditSubscriber, StockMovementImmutabilitySubscriber],
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
});

export const initializeDatabase = async (): Promise<void> => {
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connection established successfully');

        // Run migrations automatically
        await AppDataSource.runMigrations();
        console.log('✅ Migrations completed successfully');
    } catch (error) {
        console.error('❌ Error during database initialization:', error);
        throw error;
    }
};
