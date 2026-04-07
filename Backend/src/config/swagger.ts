import fs from 'fs';
import path from 'path';
import { generateDtoSchemasFromDir, generateOpenApiPaths } from './openapi-generator';

const repoRoot = path.resolve(__dirname, '..', '..');
const srcDtoDir = path.join(repoRoot, 'src', 'dto');
const distDtoDir = path.join(repoRoot, 'dist', 'dto');

const dtoDir = fs.existsSync(srcDtoDir) ? srcDtoDir : distDtoDir;
const dtoSchemas = generateDtoSchemasFromDir(dtoDir);
const generated = generateOpenApiPaths(new Set(Object.keys(dtoSchemas)));

export const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Tangacare API Documentation',
        version: '1.0.0',
        description:
            'Unified Pharmacy Inventory System (UPIS) & Telemedicine Platform REST API - Complete backend for pharmacy inventory management, healthcare consultations, appointments, and patient management',
        contact: {
            name: 'Tangacare Team',
            email: 'support@tangacare.com',
        },
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Development server',
        },
        {
            url: 'https://api.tangahubservice.com',
            description: 'Production server',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token',
            },
        },
        parameters: {
            XOrganizationId: {
                name: 'x-organization-id',
                in: 'header',
                required: false,
                schema: { type: 'integer' },
                description: 'Organization scope override (SUPER_ADMIN/OWNER). Alias: `x-org-id`.',
            },
            XOrgId: {
                name: 'x-org-id',
                in: 'header',
                required: false,
                schema: { type: 'integer' },
                description: 'Alias for `x-organization-id`.',
            },
            XFacilityId: {
                name: 'x-facility-id',
                in: 'header',
                required: false,
                schema: { type: 'integer' },
                description: 'Facility scope override (SUPER_ADMIN/OWNER). Alias: `x-tenant-id`.',
            },
            XTenantId: {
                name: 'x-tenant-id',
                in: 'header',
                required: false,
                schema: { type: 'integer' },
                description: 'Alias for `x-facility-id`.',
            },
            Page: {
                name: 'page',
                in: 'query',
                required: false,
                schema: { type: 'integer', minimum: 1, default: 1 },
                description: 'Pagination page (1-based).',
            },
            Limit: {
                name: 'limit',
                in: 'query',
                required: false,
                schema: { type: 'integer', minimum: 1, default: 10 },
                description: 'Pagination page size.',
            },
        },
        schemas: {
            User: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    phone_number: { type: 'string' },
                    email: { type: 'string' },
                    first_name: { type: 'string' },
                    last_name: { type: 'string' },
                    date_of_birth: { type: 'string', format: 'date' },
                    gender: { type: 'string' },
                    role: {
                        type: 'string',
                        enum: [
                            'patient',
                            'doctor',
                            'admin',
                            'super_admin',
                            'facility_admin',
                            'pharmacist',
                            'store_manager',
                            'auditor',
                        ],
                    },
                    is_verified: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                },
            },
            Doctor: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    license_number: { type: 'string' },
                    specialization: { type: 'string' },
                    years_of_experience: { type: 'integer' },
                    consultation_fee: { type: 'number' },
                    is_available: { type: 'boolean' },
                    rating: { type: 'number' },
                    total_consultations: { type: 'integer' },
                    bio: { type: 'string' },
                },
            },
            Appointment: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    appointment_date: { type: 'string', format: 'date-time' },
                    duration_minutes: { type: 'integer' },
                    status: { type: 'string', enum: ['scheduled', 'completed', 'cancelled', 'no_show'] },
                    consultation_type: { type: 'string', enum: ['video', 'audio', 'text'] },
                    meeting_link: { type: 'string' },
                    notes: { type: 'string' },
                },
            },
            Prescription: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    prescription_text: { type: 'string' },
                    diagnosis: { type: 'string' },
                    issued_at: { type: 'string', format: 'date-time' },
                    is_digital: { type: 'boolean' },
                    pdf_url: { type: 'string' },
                },
            },
            Payment: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    amount: { type: 'number' },
                    payment_method: {
                        type: 'string',
                        enum: ['mobile_money', 'credit_card', 'insurance', 'subscription'],
                    },
                    transaction_id: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
                    payment_gateway: { type: 'string', enum: ['flutterwave', 'paypack', 'other'] },
                },
            },
            HealthRecord: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    record_type: {
                        type: 'string',
                        enum: ['allergy', 'condition', 'medication', 'vaccination', 'other'],
                    },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    start_date: { type: 'string', format: 'date' },
                    end_date: { type: 'string', format: 'date' },
                    severity: { type: 'string' },
                },
            },
            HealthTip: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    title: { type: 'string' },
                    content: { type: 'string' },
                    category: {
                        type: 'string',
                        enum: ['general', 'nutrition', 'exercise', 'mental_health', 'prevention'],
                    },
                    language: { type: 'string', enum: ['en', 'rw'] },
                    is_published: { type: 'boolean' },
                },
            },
            ApiResponse: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'object' },
                    timestamp: { type: 'string', format: 'date-time' },
                },
            },
            Error: {
                type: 'object',
                properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string' },
                    error: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' },
                },
            },

            Facility: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    type: { type: 'string', enum: ['hospital', 'clinic', 'pharmacy_shop'] },
                    address: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    departments_enabled: { type: 'boolean' },
                    controlled_drug_rules_enabled: { type: 'boolean' },
                    min_stock_threshold_percentage: { type: 'integer' },
                    expiry_alert_days: { type: 'integer' },
                    is_active: { type: 'boolean' },
                },
            },
            Medicine: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    code: { type: 'string' },
                    name: { type: 'string' },
                    brand_name: { type: 'string' },
                    strength: { type: 'string' },
                    dosage_form: {
                        type: 'string',
                        enum: [
                            'tablet',
                            'capsule',
                            'syrup',
                            'injection',
                            'ointment',
                            'drops',
                            'inhaler',
                            'patch',
                            'other',
                        ],
                    },
                    unit: { type: 'string' },
                    is_controlled_drug: { type: 'boolean' },
                    cost_price: { type: 'number' },
                    selling_price: { type: 'number' },
                },
            },
            Batch: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    batch_number: { type: 'string' },
                    expiry_date: { type: 'string', format: 'date' },
                    manufacturing_date: { type: 'string', format: 'date' },
                    initial_quantity: { type: 'integer' },
                    current_quantity: { type: 'integer' },
                },
            },
            Stock: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    facility_id: { type: 'integer' },
                    department_id: { type: 'integer', nullable: true },
                    medicine_id: { type: 'integer' },
                    batch_id: { type: 'integer' },
                    quantity: { type: 'integer' },
                    reserved_quantity: { type: 'integer' },
                },
            },
            Supplier: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    contact_person: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string' },
                    address: { type: 'string' },
                },
            },
            PurchaseOrder: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    order_number: { type: 'string' },
                    facility_id: { type: 'integer' },
                    supplier_id: { type: 'integer' },
                    status: {
                        type: 'string',
                        enum: ['draft', 'pending', 'approved', 'partially_received', 'received', 'cancelled'],
                    },
                    total_amount: { type: 'number' },
                },
            },
            DispenseTransaction: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    transaction_number: { type: 'string' },
                    medicine_id: { type: 'integer' },
                    batch_id: { type: 'integer' },
                    quantity: { type: 'integer' },
                    dispense_type: {
                        type: 'string',
                        enum: ['prescription', 'otc', 'internal', 'transfer'],
                    },
                    total_amount: { type: 'number' },
                },
            },
            Alert: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    alert_type: {
                        type: 'string',
                        enum: ['low_stock', 'expiry_soon', 'expired', 'controlled_drug_threshold', 'reorder_suggestion'],
                    },
                    status: { type: 'string', enum: ['active', 'acknowledged', 'resolved'] },
                    title: { type: 'string' },
                    message: { type: 'string' },
                },
            },
            StockTransfer: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    transfer_number: { type: 'string' },
                    facility_id: { type: 'integer' },
                    from_department_id: { type: 'integer', nullable: true },
                    to_department_id: { type: 'integer', nullable: true },
                    status: { type: 'string', enum: ['pending', 'in_transit', 'completed', 'cancelled'] },
                    initiated_by_id: { type: 'integer' },
                    received_by_id: { type: 'integer', nullable: true },
                    transfer_date: { type: 'string', format: 'date' },
                    notes: { type: 'string' },
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'integer' },
                                medicine_id: { type: 'integer' },
                                batch_id: { type: 'integer' },
                                quantity: { type: 'integer' },
                            },
                        },
                    },
                },
            },

            Conversation: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    patient_id: { type: 'integer' },
                    doctor_id: { type: 'integer' },
                    last_message: { type: 'string', nullable: true },
                    last_message_at: { type: 'string', format: 'date-time', nullable: true },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                    unread_count: {
                        type: 'integer',
                        description: 'Number of unread messages for the current user',
                    },
                    other_user: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            first_name: { type: 'string' },
                            last_name: { type: 'string' },
                            profile_picture_url: { type: 'string', nullable: true },
                            is_online: { type: 'boolean' },
                            last_seen: { type: 'string', format: 'date-time', nullable: true },
                        },
                    },
                },
            },
            Message: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    conversation_id: { type: 'integer' },
                    sender_id: { type: 'integer' },
                    sender_type: { type: 'string', enum: ['patient', 'doctor'] },
                    content: { type: 'string' },
                    message_type: { type: 'string', enum: ['text', 'image', 'file'], default: 'text' },
                    file_url: { type: 'string', nullable: true },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                },
            },
            ...dtoSchemas,
        },
    },
    tags: generated.tags,
    paths: generated.paths,
} as const;
