import 'reflect-metadata';
import express, { Application } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';

import { initializeDatabase } from './config/database';
import { swaggerSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { requestLogger, logger } from './middleware/logger.middleware';
import { superAdminAuditMiddleware } from './middleware/super-admin-audit.middleware';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/user.routes';
import doctorRoutes from './routes/doctor.routes';
import appointmentRoutes from './routes/appointment.routes';
import reviewRoutes from './routes/review.routes';
import searchRoutes from './routes/search.routes';
import chatRoutes from './routes/chat.routes';
import callRoutes from './routes/call.routes';
import { prescriptionRouter, paymentRouter, healthRecordRouter, healthTipRouter } from './routes/generic.routes';
import publicRoutes from './routes/public.routes';
import subscriptionsRoutes from './routes/subscriptions.routes';

import organizationRoutes from './routes/pharmacy/organization.routes';
import onboardingRoutes from './routes/pharmacy/onboarding.routes';
import facilityRoutes from './routes/pharmacy/facility.routes';
import invitationRoutes from './routes/pharmacy/invitation.routes';
import medicineRoutes from './routes/pharmacy/medicine.routes';
import categoryRoutes from './routes/pharmacy/category.routes';
import stockRoutes from './routes/pharmacy/stock.routes';
import dispensingRoutes from './routes/pharmacy/dispensing.routes';
import procurementRoutes from './routes/pharmacy/procurement.routes';
import alertRoutes from './routes/pharmacy/alert.routes';
import departmentRoutes from './routes/pharmacy/department.routes';
import supplierRoutes from './routes/pharmacy/supplier.routes';
import batchRoutes from './routes/pharmacy/batch.routes';
import stockTransferRoutes from './routes/pharmacy/stock-transfer.routes';
import reportingRoutes from './routes/pharmacy/reporting.routes';
import auditRoutes from './routes/pharmacy/audit.routes';
import dashboardRoutes from './routes/pharmacy/dashboard.routes';
import saleRoutes from './routes/pharmacy/sale.routes';
import returnRoutes from './routes/pharmacy/return.routes';
import vendorReturnRoutes from './routes/pharmacy/vendor-return.routes';
import disposalRoutes from './routes/pharmacy/disposal.routes';
import kpiRoutes from './routes/pharmacy/kpi.routes';
import analyticsRoutes from './routes/pharmacy/analytics.routes';
import physicalCountRoutes from './routes/pharmacy/physical-count.routes';
import recallRoutes from './routes/pharmacy/recall.routes';
import varianceRoutes from './routes/pharmacy/variance.routes';
import insuranceRoutes from './routes/pharmacy/insurance.routes';
import storageLocationRoutes from './routes/pharmacy/storage-location.routes';
import coldChainRoutes from './routes/pharmacy/cold-chain.routes';
import parRoutes from './routes/pharmacy/par.routes';
import walkInPrescriptionRoutes from './routes/pharmacy/walkin-prescription.routes';
import { SchedulerService } from './services/pharmacy/scheduler.service';

import { SocketGateway } from './socket/socket.gateway';
import { socketAuthMiddleware } from './socket/socket.middleware';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api';

const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';

const globalRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '400', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
        req.path === '/health' ||
        req.path === '/api-docs.json' ||
        req.path.startsWith('/api-docs') ||
        req.path.startsWith(`${API_PREFIX}/public`),
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});

const authRateLimiter = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '60', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts, please try again later.' },
});

let schedulerServiceInstance: SchedulerService | null = null;
let isShuttingDown = false;

const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
    },
});

io.use(socketAuthMiddleware);

const socketGateway = new SocketGateway(io);
socketGateway.initialize();

app.use(helmet());
app.use(
    cors({
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true,
    }),
);

if (rateLimitEnabled) {
    app.use(globalRateLimiter);
}

app.use(
    express.json({
        verify: (req, _res, buf) => {
            // Needed for signature verification of payment webhooks (raw body)
            (req as any).rawBody = buf;
        },
    }),
);
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);
app.use(superAdminAuditMiddleware);

app.get('/health', (_req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerSpec);
});

app.use(
    '/api-docs',
    swaggerUi.serve as any,
    swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Tangacare API Documentation',
    }) as any,
);

if (rateLimitEnabled) {
    app.use(`${API_PREFIX}/auth`, authRateLimiter);
}
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/doctors`, doctorRoutes);
app.use(`${API_PREFIX}/appointments`, appointmentRoutes);
app.use(`${API_PREFIX}/prescriptions`, prescriptionRouter);
app.use(`${API_PREFIX}/payments`, paymentRouter);
app.use(`${API_PREFIX}/subscriptions`, subscriptionsRoutes);
app.use(`${API_PREFIX}/health-records`, healthRecordRouter);
app.use(`${API_PREFIX}/health-tips`, healthTipRouter);
app.use(`${API_PREFIX}/reviews`, reviewRoutes);
app.use(`${API_PREFIX}/search`, searchRoutes);
app.use(`${API_PREFIX}/chat`, chatRoutes);
app.use(`${API_PREFIX}/calls`, callRoutes);

app.use(`${API_PREFIX}/pharmacy/organizations`, organizationRoutes);
app.use(`${API_PREFIX}/pharmacy/onboarding`, onboardingRoutes);
app.use(`${API_PREFIX}/pharmacy/facilities`, facilityRoutes);
app.use(`${API_PREFIX}/pharmacy/invitations`, invitationRoutes);
app.use(`${API_PREFIX}/pharmacy/medicines`, medicineRoutes);
app.use(`${API_PREFIX}/pharmacy/categories`, categoryRoutes);
app.use(`${API_PREFIX}/pharmacy/stock`, stockRoutes);
app.use(`${API_PREFIX}/pharmacy/dispensing`, dispensingRoutes);
app.use(`${API_PREFIX}/pharmacy/procurement`, procurementRoutes);
app.use(`${API_PREFIX}/pharmacy/alerts`, alertRoutes);
app.use(`${API_PREFIX}/pharmacy/departments`, departmentRoutes);
app.use(`${API_PREFIX}/pharmacy/suppliers`, supplierRoutes);
app.use(`${API_PREFIX}/pharmacy/batches`, batchRoutes);
app.use(`${API_PREFIX}/pharmacy/stock-transfers`, stockTransferRoutes);
app.use(`${API_PREFIX}/pharmacy/reports`, reportingRoutes);
app.use(`${API_PREFIX}/pharmacy/audit-logs`, auditRoutes);
app.use(`${API_PREFIX}/pharmacy/sales`, saleRoutes);
app.use(`${API_PREFIX}/pharmacy/returns`, returnRoutes);
app.use(`${API_PREFIX}/pharmacy/vendor-returns`, vendorReturnRoutes);
app.use(`${API_PREFIX}/pharmacy/disposals`, disposalRoutes);
app.use(`${API_PREFIX}/pharmacy/kpis`, kpiRoutes);
app.use(`${API_PREFIX}/pharmacy/insurance`, insuranceRoutes);

app.use(`${API_PREFIX}/pharmacy`, dashboardRoutes);
app.use(`${API_PREFIX}/pharmacy/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/pharmacy/physical-counts`, physicalCountRoutes);
app.use(`${API_PREFIX}/pharmacy/recalls`, recallRoutes);
app.use(`${API_PREFIX}/pharmacy/variances`, varianceRoutes);
app.use(`${API_PREFIX}/pharmacy/storage-locations`, storageLocationRoutes);
app.use(`${API_PREFIX}/pharmacy/cold-chain`, coldChainRoutes);
app.use(`${API_PREFIX}/pharmacy/par`, parRoutes);
app.use(`${API_PREFIX}/pharmacy/walk-in-prescriptions`, walkInPrescriptionRoutes);
app.use(`${API_PREFIX}/public`, publicRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

function gracefulShutdown(signal: string): void {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    logger.info(`${signal} received — draining HTTP server and stopping scheduler`);

    try {
        schedulerServiceInstance?.shutdown();
    } catch (e) {
        logger.error('Scheduler shutdown error', e);
    }

    httpServer.close((err) => {
        if (err) {
            logger.error('Error while closing HTTP server', err);
            process.exit(1);
            return;
        }
        logger.info('HTTP server closed');
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, 25_000).unref();
}

const startServer = async (): Promise<void> => {
    try {
        await initializeDatabase();

        const schedulerService = new SchedulerService();
        schedulerServiceInstance = schedulerService;
        await schedulerService.initialize();

        if (process.argv.includes('--exit-after-init')) {
            logger.info('✅ Initialized successfully (exit-after-init). Exiting...');
            process.exit(0);
        }

        httpServer.listen(PORT, () => {
            logger.info(`🚀 Server is running on port ${PORT}`);
            logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
            logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
            logger.info(`💬 Socket.IO initialized for real-time chat`);
            logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`⏰ Pharmacy scheduler initialized - automated alert checks enabled`);
            if (rateLimitEnabled) {
                logger.info('🛡️  API rate limiting enabled (set RATE_LIMIT_ENABLED=false to disable)');
            }
        });

        process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection:', reason);
    if (process.env.NODE_ENV === 'production') {
        return;
    }
    process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

startServer();

export default app;
