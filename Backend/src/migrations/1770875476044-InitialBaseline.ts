import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialBaseline1770875476044 implements MigrationInterface {
    name = 'InitialBaseline1770875476044';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "prescriptions" ("id" SERIAL NOT NULL, "appointment_id" integer NOT NULL, "doctor_id" integer NOT NULL, "patient_id" integer NOT NULL, "prescription_text" text NOT NULL, "diagnosis" text, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_digital" boolean NOT NULL DEFAULT true, "pdf_url" character varying(255), CONSTRAINT "PK_097b2cc2f2b7e56825468188503" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "doctor_reviews" ("id" SERIAL NOT NULL, "doctor_id" integer NOT NULL, "patient_id" integer NOT NULL, "appointment_id" integer NOT NULL, "rating" integer NOT NULL, "review_text" text, "is_featured" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_c734e2cb2754e4a6e2651ca73d" UNIQUE ("appointment_id"), CONSTRAINT "PK_f0335ada748eaa9095e27288a97" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."appointments_status_enum" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."appointments_consultation_type_enum" AS ENUM('video', 'audio', 'text'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "appointments" ("id" SERIAL NOT NULL, "patient_id" integer NOT NULL, "doctor_id" integer NOT NULL, "appointment_date" TIMESTAMP WITH TIME ZONE NOT NULL, "duration_minutes" integer NOT NULL DEFAULT '15', "status" "public"."appointments_status_enum" NOT NULL DEFAULT 'scheduled', "consultation_type" "public"."appointments_consultation_type_enum" NOT NULL, "meeting_link" character varying(255), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "doctors" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "license_number" character varying(50) NOT NULL, "specialization" character varying(100) NOT NULL, "years_of_experience" integer, "consultation_fee" numeric(10,2) NOT NULL, "is_available" boolean NOT NULL DEFAULT true, "rating" numeric(3,2) NOT NULL DEFAULT '0', "total_consultations" integer NOT NULL DEFAULT '0', "bio" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_16d3ee4c62bb957e17d70412632" UNIQUE ("license_number"), CONSTRAINT "PK_8207e7889b50ee3695c2b8154ff" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."payments_payment_method_enum" AS ENUM('mobile_money', 'credit_card', 'insurance', 'subscription'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'completed', 'failed', 'refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."payments_payment_gateway_enum" AS ENUM('flutterwave', 'paypack', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "payments" ("id" SERIAL NOT NULL, "appointment_id" integer, "patient_id" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "payment_method" "public"."payments_payment_method_enum" NOT NULL, "transaction_id" character varying(100) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending', "payment_gateway" "public"."payments_payment_gateway_enum" NOT NULL, "payment_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_3c324ca49dabde7ffc0ef64675d" UNIQUE ("transaction_id"), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."health_records_record_type_enum" AS ENUM('allergy', 'condition', 'medication', 'vaccination', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "health_records" ("id" SERIAL NOT NULL, "patient_id" integer NOT NULL, "record_type" "public"."health_records_record_type_enum" NOT NULL, "name" character varying(100) NOT NULL, "description" text, "start_date" date, "end_date" date, "severity" character varying(20), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_adbd60dda85d616da89ba3f8270" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."health_tips_category_enum" AS ENUM('general', 'nutrition', 'exercise', 'mental_health', 'prevention'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."health_tips_language_enum" AS ENUM('en', 'rw'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "health_tips" ("id" SERIAL NOT NULL, "title" character varying(255) NOT NULL, "content" text NOT NULL, "category" "public"."health_tips_category_enum" NOT NULL, "language" "public"."health_tips_language_enum" NOT NULL DEFAULT 'en', "is_published" boolean NOT NULL DEFAULT false, "published_at" TIMESTAMP WITH TIME ZONE, "author_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_50018577eda7f43d55ce5feea5f" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."dispense_transactions_dispense_type_enum" AS ENUM('prescription', 'otc', 'internal', 'transfer'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "dispense_transactions" ("id" SERIAL NOT NULL, "transaction_number" character varying(100) NOT NULL, "facility_id" integer NOT NULL, "department_id" integer, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "quantity" integer NOT NULL, "dispense_type" "public"."dispense_transactions_dispense_type_enum" NOT NULL, "patient_id" integer, "prescription_id" integer, "dispensed_by_id" integer NOT NULL, "unit_price" numeric(10,2), "total_amount" numeric(10,2), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4cc4387386c7b21e20ca15240da" UNIQUE ("transaction_number"), CONSTRAINT "PK_fb1e601a963b36edf6794e392d9" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_41ccd4f2308af8bed045960de3" ON "dispense_transactions" ("facility_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "batches" ("id" SERIAL NOT NULL, "medicine_id" integer NOT NULL, "batch_number" character varying(100) NOT NULL, "expiry_date" date NOT NULL, "manufacturing_date" date NOT NULL, "initial_quantity" integer NOT NULL DEFAULT '0', "current_quantity" integer NOT NULL DEFAULT '0', "unit_cost" numeric(10,2), "supplier" character varying(255), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_55e7ff646e969b61d37eea5be7a" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_c43843ed1d0bd2c7e2b08c610f" ON "batches" ("medicine_id", "batch_number") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."organizations_type_enum" AS ENUM('pharmacy_chain', 'single_pharmacy', 'clinic', 'hospital'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."organizations_subscription_status_enum" AS ENUM('active', 'trial', 'suspended', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "organizations" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "code" character varying(100), "type" "public"."organizations_type_enum" NOT NULL DEFAULT 'single_pharmacy', "subscription_status" "public"."organizations_subscription_status_enum" NOT NULL DEFAULT 'active', "address" text, "phone" character varying(20), "email" character varying(255), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "suppliers" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "contact_person" character varying(100), "phone" character varying(20), "email" character varying(255), "address" text, "tax_id" character varying(100), "notes" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "facility_id" integer, "organization_id" integer, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b70ac51766a9e3144f778cfe81e" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."purchase_orders_status_enum" AS ENUM('draft', 'pending', 'approved', 'partially_received', 'received', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "purchase_orders" ("id" SERIAL NOT NULL, "order_number" character varying(100) NOT NULL, "facility_id" integer NOT NULL, "organization_id" integer, "supplier_id" integer NOT NULL, "created_by_id" integer NOT NULL, "status" "public"."purchase_orders_status_enum" NOT NULL DEFAULT 'draft', "order_date" date, "expected_delivery_date" date, "received_date" date, "subtotal_amount" numeric(10,2) NOT NULL DEFAULT '0', "discount_percent" numeric(5,2), "discount_amount" numeric(10,2) NOT NULL DEFAULT '0', "vat_rate" numeric(5,2), "vat_amount" numeric(10,2) NOT NULL DEFAULT '0', "total_amount" numeric(10,2) NOT NULL DEFAULT '0', "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b297010fff05faf7baf4e67afa7" UNIQUE ("order_number"), CONSTRAINT "PK_05148947415204a897e8beb2553" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "purchase_order_items" ("id" SERIAL NOT NULL, "purchase_order_id" integer NOT NULL, "medicine_id" integer NOT NULL, "quantity_ordered" integer NOT NULL, "quantity_received" integer NOT NULL DEFAULT '0', "unit_price" numeric(10,2) NOT NULL, "total_price" numeric(10,2) NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e8b7568d25c41e3290db596b312" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "medicine_categories" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "code" character varying(50) NOT NULL, "default_markup_percent" numeric(5,2), "organization_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_65570b2a887d4973deb8a139b35" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."medicines_dosage_form_enum" AS ENUM('tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'inhaler', 'patch', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "medicines" ("id" SERIAL NOT NULL, "code" character varying(255) NOT NULL, "barcode" character varying(255), "name" character varying(255) NOT NULL, "brand_name" character varying(255), "strength" character varying(100), "dosage_form" "public"."medicines_dosage_form_enum" NOT NULL, "unit" character varying(50), "storage_conditions" text, "is_controlled_drug" boolean NOT NULL DEFAULT false, "description" text, "cost_price" numeric(10,2), "selling_price" numeric(10,2), "markup_percent" numeric(5,2), "min_stock_level" integer NOT NULL DEFAULT '0', "target_stock_level" integer NOT NULL DEFAULT '0', "lead_time_days" integer NOT NULL DEFAULT '7', "safety_stock_quantity" integer NOT NULL DEFAULT '0', "reorder_point" integer, "avg_daily_consumption" numeric(10,2), "is_critical_medicine" boolean NOT NULL DEFAULT false, "last_consumption_calculated_at" TIMESTAMP WITH TIME ZONE, "units_per_package" integer DEFAULT '1', "base_unit" character varying(50), "allow_partial_sales" boolean NOT NULL DEFAULT false, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "category_id" integer, CONSTRAINT "UQ_c4c9ac38aba0468688754ec2036" UNIQUE ("code"), CONSTRAINT "UQ_5b1334d794bdf0ec82799a832f7" UNIQUE ("barcode"), CONSTRAINT "PK_77b93851766f7ab93f71f44b18b" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "stocks" ("id" SERIAL NOT NULL, "facility_id" integer NOT NULL, "department_id" integer, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "quantity" integer NOT NULL DEFAULT '0', "reserved_quantity" integer NOT NULL DEFAULT '0', "unit_cost" numeric(10,2), "unit_price" numeric(10,2), "is_deleted" boolean NOT NULL DEFAULT false, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by_id" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b5b1ee4ac914767229337974575" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ba88b4aac504d9b3bc05887bca" ON "stocks" ("facility_id", "medicine_id", "batch_id", "department_id") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."stock_transfers_status_enum" AS ENUM('pending', 'in_transit', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "stock_transfers" ("id" SERIAL NOT NULL, "transfer_number" character varying(100) NOT NULL, "facility_id" integer NOT NULL, "from_department_id" integer, "to_department_id" integer, "status" "public"."stock_transfers_status_enum" NOT NULL DEFAULT 'pending', "initiated_by_id" integer NOT NULL, "received_by_id" integer, "transfer_date" date, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e6943db71fc295dca9bbe16b85c" UNIQUE ("transfer_number"), CONSTRAINT "PK_ef738a3a4a578c7f1802c1bb50a" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_fba752c32879fc788f3faaec5a" ON "stock_transfers" ("facility_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "stock_transfer_items" ("id" SERIAL NOT NULL, "transfer_id" integer NOT NULL, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "quantity" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8acee6121ab8a5135dc84495588" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "departments" ("id" SERIAL NOT NULL, "facility_id" integer NOT NULL, "name" character varying(255) NOT NULL, "description" text, "location" character varying(50), "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_839517a681a86bb84cbcc6a1e9d" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('create', 'update', 'delete', 'dispense', 'receive', 'transfer', 'adjustment', 'login', 'logout', 'access_denied'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."audit_logs_entity_type_enum" AS ENUM('facility', 'department', 'medicine', 'batch', 'stock', 'supplier', 'purchase_order', 'dispense_transaction', 'stock_transfer', 'alert', 'user'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" SERIAL NOT NULL, "facility_id" integer, "user_id" integer, "action" "public"."audit_logs_action_enum" NOT NULL, "entity_type" "public"."audit_logs_entity_type_enum" NOT NULL, "entity_id" integer, "entity_name" character varying(255), "description" text, "old_values" jsonb, "new_values" jsonb, "ip_address" character varying(45), "user_agent" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_2f68e345c05e8166ff9deea1ab" ON "audit_logs" ("user_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_a4af40b14c3057ba729bd810e8" ON "audit_logs" ("facility_id", "created_at") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."facilities_type_enum" AS ENUM('hospital', 'clinic', 'pharmacy_shop'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "facilities" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "address" text, "phone" character varying(20), "email" character varying(255), "type" "public"."facilities_type_enum" NOT NULL, "departments_enabled" boolean NOT NULL DEFAULT true, "controlled_drug_rules_enabled" boolean NOT NULL DEFAULT true, "min_stock_threshold_percentage" integer NOT NULL DEFAULT '10', "expiry_alert_days" integer NOT NULL DEFAULT '30', "default_markup_percent" numeric(5,2), "organization_id" integer, "facility_admin_id" integer, "configuration" jsonb, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2e6c685b2e1195e6d6394a22bc7" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."users_role_enum" AS ENUM('patient', 'doctor', 'admin', 'super_admin', 'facility_admin', 'owner', 'cashier', 'pharmacist', 'store_manager', 'auditor'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "users" ("id" SERIAL NOT NULL, "phone_number" character varying(20), "email" character varying(255), "password_hash" character varying(255) NOT NULL, "first_name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "date_of_birth" date, "gender" character varying(10), "address" text, "preferred_language" character varying(10) NOT NULL DEFAULT 'en', "profile_picture_url" character varying(255), "is_verified" boolean NOT NULL DEFAULT false, "role" "public"."users_role_enum" NOT NULL DEFAULT 'patient', "is_active" boolean NOT NULL DEFAULT true, "is_online" boolean NOT NULL DEFAULT false, "last_seen" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, "otp_code" character varying(6), "otp_expires_at" TIMESTAMP WITH TIME ZONE, "organization_id" integer, "facility_id" integer, "must_set_password" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_17d1817f241f10a3dbafb169fd2" UNIQUE ("phone_number"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "message_reads" ("id" SERIAL NOT NULL, "message_id" integer NOT NULL, "user_id" integer NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d3be462a9d7dfbbccc93c097e1" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_504f22ef54941c99b9ec9e31c3" ON "message_reads" ("message_id", "user_id") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."messages_sender_type_enum" AS ENUM('patient', 'doctor'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."messages_message_type_enum" AS ENUM('text', 'image', 'file'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "messages" ("id" SERIAL NOT NULL, "conversation_id" integer NOT NULL, "sender_id" integer NOT NULL, "sender_type" "public"."messages_sender_type_enum" NOT NULL, "content" text NOT NULL, "message_type" "public"."messages_message_type_enum" NOT NULL DEFAULT 'text', "file_url" character varying(500), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_8584a1974e1ca95f4861d975ff" ON "messages" ("conversation_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "conversations" ("id" SERIAL NOT NULL, "patient_id" integer NOT NULL, "doctor_id" integer NOT NULL, "last_message" text, "last_message_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_d3b49e2e0edb69d0d3f320bd70" ON "conversations" ("patient_id", "doctor_id") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."calls_call_type_enum" AS ENUM('audio', 'video'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."calls_status_enum" AS ENUM('initiated', 'ringing', 'accepted', 'rejected', 'ended', 'missed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "calls" ("id" SERIAL NOT NULL, "conversation_id" integer NOT NULL, "caller_id" integer NOT NULL, "callee_id" integer NOT NULL, "call_type" "public"."calls_call_type_enum" NOT NULL, "status" "public"."calls_status_enum" NOT NULL DEFAULT 'initiated', "started_at" TIMESTAMP WITH TIME ZONE, "ended_at" TIMESTAMP WITH TIME ZONE, "duration" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d9171d91f8dd1a649659f1b6a20" PRIMARY KEY ("id")); COMMENT ON COLUMN "calls"."duration" IS 'Duration in seconds'`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_56866f9821fa5506e122b84ec0" ON "calls" ("callee_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_63ae2152fde2f6f70138d1aec0" ON "calls" ("caller_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_3de9262959061210705173b97c" ON "calls" ("conversation_id", "created_at") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."notifications_type_enum" AS ENUM('new_message', 'appointment_reminder', 'appointment_confirmed', 'appointment_cancelled', 'prescription_ready', 'payment_received', 'health_tip', 'po_submitted', 'po_approved', 'po_received', 'po_cancelled', 'po_sent', 'low_stock', 'item_expiry'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "notifications" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "title" character varying(255) NOT NULL, "message" text NOT NULL, "data" jsonb, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_310667f935698fcd8cb319113a" ON "notifications" ("user_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_af08fad7c04bb85403970afdc1" ON "notifications" ("user_id", "is_read") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."alerts_alert_type_enum" AS ENUM('low_stock', 'expiry_soon', 'expired', 'controlled_drug_threshold', 'reorder_suggestion'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."alerts_status_enum" AS ENUM('active', 'acknowledged', 'resolved'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "alerts" ("id" SERIAL NOT NULL, "facility_id" integer NOT NULL, "alert_type" "public"."alerts_alert_type_enum" NOT NULL, "status" "public"."alerts_status_enum" NOT NULL DEFAULT 'active', "medicine_id" integer, "batch_id" integer, "title" character varying(255) NOT NULL, "message" text NOT NULL, "current_value" integer, "threshold_value" integer, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "acknowledged_by_id" integer, "resolved_at" TIMESTAMP WITH TIME ZONE, "resolved_by_id" integer, "action_taken" character varying(100), "action_reason" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_e29bf849c487a41f37cc212504" ON "alerts" ("facility_id", "status", "alert_type") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."sales_status_enum" AS ENUM('paid', 'partially_paid', 'unpaid', 'voided'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "sales" ("id" SERIAL NOT NULL, "sale_number" character varying(100) NOT NULL, "facility_id" integer NOT NULL, "patient_id" integer, "cashier_id" integer NOT NULL, "subtotal" numeric(10,2) NOT NULL DEFAULT '0', "vat_rate" numeric(5,4) NOT NULL DEFAULT '0.18', "vat_amount" numeric(10,2) NOT NULL DEFAULT '0', "total_amount" numeric(10,2) NOT NULL DEFAULT '0', "paid_amount" numeric(10,2) NOT NULL DEFAULT '0', "balance_amount" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."sales_status_enum" NOT NULL DEFAULT 'unpaid', "fiscal_status" character varying(20) DEFAULT 'pending', "ebm_submitted_at" TIMESTAMP WITH TIME ZONE, "ebm_reference" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4ef0fb3b23e3a0bdc11514270aa" UNIQUE ("sale_number"), CONSTRAINT "PK_4f0bc990ae81dba46da680895ea" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_503618ec9ee0b5c35689ae55f6" ON "sales" ("facility_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "sale_items" ("id" SERIAL NOT NULL, "sale_id" integer NOT NULL, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "quantity" integer NOT NULL, "unit_price" numeric(10,2) NOT NULL, "unit_cost" numeric(10,2), "total_price" numeric(10,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5a7dc5b4562a9e590528b3e08ab" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c210a330b80232c29c2ad68462" ON "sale_items" ("sale_id") `);
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."sale_payments_method_enum" AS ENUM('cash', 'mobile_money', 'bank', 'card'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "sale_payments" ("id" SERIAL NOT NULL, "sale_id" integer NOT NULL, "method" "public"."sale_payments_method_enum" NOT NULL, "amount" numeric(10,2) NOT NULL, "reference" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1117d02608a00d131b95f60a58e" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0e4445597642c2456ebdd7e23b" ON "sale_payments" ("sale_id") `);
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "credit_notes" ("id" SERIAL NOT NULL, "note_number" character varying(100) NOT NULL, "sale_id" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "reason" text, "fiscal_status" character varying(20) NOT NULL DEFAULT 'pending', "ebm_reference" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ffb8769c8a442af5092b9f7abf7" UNIQUE ("note_number"), CONSTRAINT "PK_4933888a20b5469e119ad74b9e9" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3b00782ddf92177eced19a0597" ON "credit_notes" ("sale_id") `);
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "debit_notes" ("id" SERIAL NOT NULL, "note_number" character varying(100) NOT NULL, "sale_id" integer NOT NULL, "amount" numeric(10,2) NOT NULL, "reason" text, "fiscal_status" character varying(20) NOT NULL DEFAULT 'pending', "ebm_reference" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_559a14c1b65d24ff745ca057359" UNIQUE ("note_number"), CONSTRAINT "PK_e1f73e65add1542776ce7087fae" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_58f0559f303763439b0bf01a6b" ON "debit_notes" ("sale_id") `);
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "services" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "code" character varying(50) NOT NULL, "price" numeric(10,2) NOT NULL DEFAULT '0', "description" text, "facility_id" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ba2d347a3168a296416c6c5ccb2" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a11338e9d5e1be6b05a6709733" ON "services" ("facility_id", "code") `,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "support_tickets" ("id" SERIAL NOT NULL, "ticket_number" character varying(100) NOT NULL, "user_id" integer NOT NULL, "subject" character varying(255) NOT NULL, "description" text NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'open', "response" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_27bc711a89a033d5318df5e0201" UNIQUE ("ticket_number"), CONSTRAINT "PK_942e8d8f5df86100471d2324643" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_2c64c96842bf9f94b3f8cd262b" ON "support_tickets" ("user_id", "created_at") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."stock_movements_type_enum" AS ENUM('in', 'out', 'adjustment', 'transfer_in', 'transfer_out', 'return'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."stock_movements_reason_enum" AS ENUM('physical_count', 'damage', 'expiry', 'theft', 'loss', 'found', 'correction', 'transfer', 'return_to_supplier', 'customer_return', 'sample', 'donation', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "stock_movements" ("id" SERIAL NOT NULL, "facility_id" integer NOT NULL, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "type" "public"."stock_movements_type_enum" NOT NULL, "reason" "public"."stock_movements_reason_enum", "quantity" integer NOT NULL, "previous_balance" integer NOT NULL, "new_balance" integer NOT NULL, "reference_type" character varying(50), "reference_id" integer, "user_id" integer, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_bed9ede4e01a5a8072732a9415" ON "stock_movements" ("reference_type", "reference_id") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_75975b20aca06c5cbcfe7148ca" ON "stock_movements" ("batch_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_40685dfd2f588349c17b76e0e5" ON "stock_movements" ("medicine_id", "created_at") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_94631628fca6c2f95bda97b0df" ON "stock_movements" ("facility_id", "created_at") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."customer_returns_refund_method_enum" AS ENUM('cash', 'mobile_money', 'credit_note'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."customer_returns_status_enum" AS ENUM('pending', 'approved', 'completed', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "customer_returns" ("id" SERIAL NOT NULL, "return_number" character varying(100) NOT NULL, "sale_id" integer NOT NULL, "facility_id" integer NOT NULL, "processed_by_id" integer NOT NULL, "total_refund_amount" numeric(10,2) NOT NULL, "refund_method" "public"."customer_returns_refund_method_enum" NOT NULL, "status" "public"."customer_returns_status_enum" NOT NULL DEFAULT 'pending', "notes" text, "approved_by_id" integer, "approved_at" TIMESTAMP, "credit_note_id" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2c676764d35f92c59b689e7824b" UNIQUE ("return_number"), CONSTRAINT "PK_b6901ab4ff204cb64b86380e917" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_66d3706b3c80efaa7feffa46da" ON "customer_returns" ("created_at") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_1db59fe80a9318928c71cff21f" ON "customer_returns" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_d053b6b07132878be609e4c914" ON "customer_returns" ("facility_id") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c9e419e7c5a6a3e37cfb9deafe" ON "customer_returns" ("sale_id") `);
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."customer_return_items_reason_enum" AS ENUM('expired', 'damaged', 'wrong_item', 'customer_request', 'adverse_reaction', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."customer_return_items_condition_enum" AS ENUM('resellable', 'damaged', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "customer_return_items" ("id" SERIAL NOT NULL, "return_id" integer NOT NULL, "sale_item_id" integer NOT NULL, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "quantity_returned" integer NOT NULL, "reason" "public"."customer_return_items_reason_enum" NOT NULL, "condition" "public"."customer_return_items_condition_enum" NOT NULL, "refund_amount" numeric(10,2) NOT NULL, "restore_to_stock" boolean NOT NULL DEFAULT false, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_57ee844ca74cca9632d47a18992" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_b0ad27610c031739837b3d6935" ON "customer_return_items" ("medicine_id") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_849b6b5dbcccc32b85e92cbf92" ON "customer_return_items" ("sale_item_id") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_f903f082e95c0d135a872ccd1c" ON "customer_return_items" ("return_id") `,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."physical_counts_status_enum" AS ENUM('in_progress', 'completed', 'approved', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "physical_counts" ("id" SERIAL NOT NULL, "facility_id" integer NOT NULL, "count_date" date NOT NULL, "status" "public"."physical_counts_status_enum" NOT NULL DEFAULT 'in_progress', "counted_by_id" integer NOT NULL, "approved_by_id" integer, "approved_at" TIMESTAMP WITH TIME ZONE, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_87f0a5f3fd3ffeb95f0c95d796d" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "physical_count_items" ("id" SERIAL NOT NULL, "physical_count_id" integer NOT NULL, "medicine_id" integer NOT NULL, "batch_id" integer NOT NULL, "system_quantity" integer NOT NULL, "counted_quantity" integer NOT NULL, "variance" integer NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_957d40bbd7912015cad46cab4a0" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_94491da15bc982f3435690fc96e" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_2d6a1941bd705056030c2b9e07d" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_9389db557647131856661f7d7b5" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "doctor_reviews" ADD CONSTRAINT "FK_38dc65a98266f746f273b5418f8" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "doctor_reviews" ADD CONSTRAINT "FK_3a347abe4150a4804809d1630f8" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "doctor_reviews" ADD CONSTRAINT "FK_c734e2cb2754e4a6e2651ca73d8" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "appointments" ADD CONSTRAINT "FK_3330f054416745deaa2cc130700" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "appointments" ADD CONSTRAINT "FK_4cf26c3f972d014df5c68d503d2" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "doctors" ADD CONSTRAINT "FK_653c27d1b10652eb0c7bbbc4427" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "FK_9f49987820da519f855d04c82bd" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "payments" ADD CONSTRAINT "FK_4d2ce22525e1801b449f24a9898" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "health_records" ADD CONSTRAINT "FK_3f0ddc85e70c567d05c28ba50f8" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "health_tips" ADD CONSTRAINT "FK_a8b25c9fc635655c841da77146d" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_1ef721db95d385d5fbabc42546b" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_6f549f1230d9ef2433f41c035bf" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_b8a783154e267654deb361dfb17" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_090896ecdcdc38d49d3b505aa78" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_38270f43bcc6857d7cb89050f13" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_9d396dcda6f6fd9edb2e9e90620" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "dispense_transactions" ADD CONSTRAINT "FK_8071b7fe521804b6a4951dbccda" FOREIGN KEY ("dispensed_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "batches" ADD CONSTRAINT "FK_7caa4282b9d3c923684ba4889f1" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "suppliers" ADD CONSTRAINT "FK_5837cb046dac22a8b4f854509ea" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "suppliers" ADD CONSTRAINT "FK_3e9f69576d3622550efafbd6e4b" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_d22726686627539726874f183ef" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_d16a885aa88447ccfd010e739b0" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_1fdd0d65d22a9a9b3d43d7392d1" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_ae7f7b1d42c24b9ef3eb6d8d966" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_3f92bb44026cedfe235c8b91244" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_e5c1775385a9d89df69316ba36a" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "medicine_categories" ADD CONSTRAINT "FK_983a355e7c9875ca61298fe360f" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "medicines" ADD CONSTRAINT "FK_3f31019204c444b5b8c16cc0a5e" FOREIGN KEY ("category_id") REFERENCES "medicine_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stocks" ADD CONSTRAINT "FK_739a73edbccface297805f41f2d" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stocks" ADD CONSTRAINT "FK_8a6ed191e8bfabc70976352f4b8" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stocks" ADD CONSTRAINT "FK_9302ae54bb061dbde977d99049a" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stocks" ADD CONSTRAINT "FK_7716bdcee0c71001d78f905cff9" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stocks" ADD CONSTRAINT "FK_57a75615d5c20ab5880e80aa61e" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_501a6d285c9dcd0a1bd5f57f2fb" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_6c77284a4f1e89f5bdc85ee44cd" FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_36cc6c083b1e682849fa701eb7d" FOREIGN KEY ("to_department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_08bd5f33cce4cd97823ac9ed644" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_a6051c0d73bff61007ab67b9e0b" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "FK_6a0f024e84c92b964c516aa7b79" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "FK_8a95c60a0e59b7dde4cdc4e66f7" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "FK_b24b650e4e2bc959620b13097a5" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "departments" ADD CONSTRAINT "FK_0d2c3c44e1eae5d90576dadf048" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_cdb2157a793c1edb481dc84d570" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "facilities" ADD CONSTRAINT "FK_a8dde092d9bf72f2e0c2db294ef" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "facilities" ADD CONSTRAINT "FK_e503d24b77582caa79027757879" FOREIGN KEY ("facility_admin_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "FK_21a659804ed7bf61eb91688dea7" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "FK_5cce3415d144173ca33ed1d8626" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "FK_977d4dcdd4dcb8441bac1b2d967" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "FK_f2fde665440a5f6a7c2ea22f2bd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "FK_21a2087c059fdd819b2ccd8d8da" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "conversations" ADD CONSTRAINT "FK_6b1fbb6dd3e64e10a45de7317f9" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "calls" ADD CONSTRAINT "FK_c17e38914dbe45bdccc4df90317" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "calls" ADD CONSTRAINT "FK_8d8b052cf7b6c41b6081c28e3f7" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "calls" ADD CONSTRAINT "FK_fbb74a6e36357bfec4f668b18ae" FOREIGN KEY ("callee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alerts" ADD CONSTRAINT "FK_7edf3e5aba98ea14edba6e28512" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alerts" ADD CONSTRAINT "FK_f5099991444c09675039707e40d" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alerts" ADD CONSTRAINT "FK_9bbfb58ca0db5e9d5fdf5dbfae0" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sales" ADD CONSTRAINT "FK_685ec9c9d190564c5744a346be0" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sales" ADD CONSTRAINT "FK_742b48cee8319453602e7d6fd4b" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sales" ADD CONSTRAINT "FK_52ad26d289eda84215d133ff0f8" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sale_items" ADD CONSTRAINT "FK_c210a330b80232c29c2ad68462a" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sale_items" ADD CONSTRAINT "FK_1b3b68db226a9c68c4acc1dafe0" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sale_items" ADD CONSTRAINT "FK_6510bee02a86eca458a8572af6e" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "sale_payments" ADD CONSTRAINT "FK_0e4445597642c2456ebdd7e23b1" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "credit_notes" ADD CONSTRAINT "FK_3b00782ddf92177eced19a05973" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "debit_notes" ADD CONSTRAINT "FK_58f0559f303763439b0bf01a6b3" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "services" ADD CONSTRAINT "FK_15e243a5134e46206e55652256c" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "support_tickets" ADD CONSTRAINT "FK_0b1eb4f1f984aab3c481c48468a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_2c9d83e49c718746baa95852384" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_eae07a803fb8d09a00a3f63b69c" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_64c67f927d872a7e19700ab6637" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_d7fedfd6ee0f4a06648c48631c6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "customer_returns" ADD CONSTRAINT "FK_c9e419e7c5a6a3e37cfb9deafe2" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "customer_returns" ADD CONSTRAINT "FK_d053b6b07132878be609e4c9144" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "customer_returns" ADD CONSTRAINT "FK_9f4fd3595644cddb96cf0da314c" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "customer_returns" ADD CONSTRAINT "FK_73c9ec6d3d830db297eb2e982dd" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "customer_return_items" ADD CONSTRAINT "FK_f903f082e95c0d135a872ccd1c4" FOREIGN KEY ("return_id") REFERENCES "customer_returns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "physical_counts" ADD CONSTRAINT "FK_c397930f5541170760c5f035ff5" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "physical_counts" ADD CONSTRAINT "FK_ce9f2f22303de86679b03b284ee" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "physical_counts" ADD CONSTRAINT "FK_a0e9a6831cd56f9c7cb1b2e3dbd" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "physical_count_items" ADD CONSTRAINT "FK_247590f9a59e28364890d979d9a" FOREIGN KEY ("physical_count_id") REFERENCES "physical_counts"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "physical_count_items" ADD CONSTRAINT "FK_e7673b5c4195c93ae2781de6417" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "physical_count_items" ADD CONSTRAINT "FK_4c0fc92a00a960779c7b6091e27" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "physical_count_items" DROP CONSTRAINT "FK_4c0fc92a00a960779c7b6091e27"`);
        await queryRunner.query(`ALTER TABLE "physical_count_items" DROP CONSTRAINT "FK_e7673b5c4195c93ae2781de6417"`);
        await queryRunner.query(`ALTER TABLE "physical_count_items" DROP CONSTRAINT "FK_247590f9a59e28364890d979d9a"`);
        await queryRunner.query(`ALTER TABLE "physical_counts" DROP CONSTRAINT "FK_a0e9a6831cd56f9c7cb1b2e3dbd"`);
        await queryRunner.query(`ALTER TABLE "physical_counts" DROP CONSTRAINT "FK_ce9f2f22303de86679b03b284ee"`);
        await queryRunner.query(`ALTER TABLE "physical_counts" DROP CONSTRAINT "FK_c397930f5541170760c5f035ff5"`);
        await queryRunner.query(`ALTER TABLE "customer_return_items" DROP CONSTRAINT "FK_f903f082e95c0d135a872ccd1c4"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT "FK_73c9ec6d3d830db297eb2e982dd"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT "FK_9f4fd3595644cddb96cf0da314c"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT "FK_d053b6b07132878be609e4c9144"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT "FK_c9e419e7c5a6a3e37cfb9deafe2"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_d7fedfd6ee0f4a06648c48631c6"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_64c67f927d872a7e19700ab6637"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_eae07a803fb8d09a00a3f63b69c"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_2c9d83e49c718746baa95852384"`);
        await queryRunner.query(`ALTER TABLE "support_tickets" DROP CONSTRAINT "FK_0b1eb4f1f984aab3c481c48468a"`);
        await queryRunner.query(`ALTER TABLE "services" DROP CONSTRAINT "FK_15e243a5134e46206e55652256c"`);
        await queryRunner.query(`ALTER TABLE "debit_notes" DROP CONSTRAINT "FK_58f0559f303763439b0bf01a6b3"`);
        await queryRunner.query(`ALTER TABLE "credit_notes" DROP CONSTRAINT "FK_3b00782ddf92177eced19a05973"`);
        await queryRunner.query(`ALTER TABLE "sale_payments" DROP CONSTRAINT "FK_0e4445597642c2456ebdd7e23b1"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_6510bee02a86eca458a8572af6e"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_1b3b68db226a9c68c4acc1dafe0"`);
        await queryRunner.query(`ALTER TABLE "sale_items" DROP CONSTRAINT "FK_c210a330b80232c29c2ad68462a"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_52ad26d289eda84215d133ff0f8"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_742b48cee8319453602e7d6fd4b"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT "FK_685ec9c9d190564c5744a346be0"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_9bbfb58ca0db5e9d5fdf5dbfae0"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_f5099991444c09675039707e40d"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_7edf3e5aba98ea14edba6e28512"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_fbb74a6e36357bfec4f668b18ae"`);
        await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_8d8b052cf7b6c41b6081c28e3f7"`);
        await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_c17e38914dbe45bdccc4df90317"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_6b1fbb6dd3e64e10a45de7317f9"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_21a2087c059fdd819b2ccd8d8da"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`);
        await queryRunner.query(`ALTER TABLE "message_reads" DROP CONSTRAINT "FK_f2fde665440a5f6a7c2ea22f2bd"`);
        await queryRunner.query(`ALTER TABLE "message_reads" DROP CONSTRAINT "FK_977d4dcdd4dcb8441bac1b2d967"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_5cce3415d144173ca33ed1d8626"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_21a659804ed7bf61eb91688dea7"`);
        await queryRunner.query(`ALTER TABLE "facilities" DROP CONSTRAINT "FK_e503d24b77582caa79027757879"`);
        await queryRunner.query(`ALTER TABLE "facilities" DROP CONSTRAINT "FK_a8dde092d9bf72f2e0c2db294ef"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_bd2726fd31b35443f2245b93ba0"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_cdb2157a793c1edb481dc84d570"`);
        await queryRunner.query(`ALTER TABLE "departments" DROP CONSTRAINT "FK_0d2c3c44e1eae5d90576dadf048"`);
        await queryRunner.query(`ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "FK_b24b650e4e2bc959620b13097a5"`);
        await queryRunner.query(`ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "FK_8a95c60a0e59b7dde4cdc4e66f7"`);
        await queryRunner.query(`ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "FK_6a0f024e84c92b964c516aa7b79"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_a6051c0d73bff61007ab67b9e0b"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_08bd5f33cce4cd97823ac9ed644"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_36cc6c083b1e682849fa701eb7d"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_6c77284a4f1e89f5bdc85ee44cd"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_501a6d285c9dcd0a1bd5f57f2fb"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP CONSTRAINT "FK_57a75615d5c20ab5880e80aa61e"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP CONSTRAINT "FK_7716bdcee0c71001d78f905cff9"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP CONSTRAINT "FK_9302ae54bb061dbde977d99049a"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP CONSTRAINT "FK_8a6ed191e8bfabc70976352f4b8"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP CONSTRAINT "FK_739a73edbccface297805f41f2d"`);
        await queryRunner.query(`ALTER TABLE "medicines" DROP CONSTRAINT "FK_3f31019204c444b5b8c16cc0a5e"`);
        await queryRunner.query(`ALTER TABLE "medicine_categories" DROP CONSTRAINT "FK_983a355e7c9875ca61298fe360f"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP CONSTRAINT "FK_e5c1775385a9d89df69316ba36a"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP CONSTRAINT "FK_3f92bb44026cedfe235c8b91244"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_ae7f7b1d42c24b9ef3eb6d8d966"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_1fdd0d65d22a9a9b3d43d7392d1"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_d16a885aa88447ccfd010e739b0"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_d22726686627539726874f183ef"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_3e9f69576d3622550efafbd6e4b"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT "FK_5837cb046dac22a8b4f854509ea"`);
        await queryRunner.query(`ALTER TABLE "batches" DROP CONSTRAINT "FK_7caa4282b9d3c923684ba4889f1"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_8071b7fe521804b6a4951dbccda"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_9d396dcda6f6fd9edb2e9e90620"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_38270f43bcc6857d7cb89050f13"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_090896ecdcdc38d49d3b505aa78"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_b8a783154e267654deb361dfb17"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_6f549f1230d9ef2433f41c035bf"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP CONSTRAINT "FK_1ef721db95d385d5fbabc42546b"`);
        await queryRunner.query(`ALTER TABLE "health_tips" DROP CONSTRAINT "FK_a8b25c9fc635655c841da77146d"`);
        await queryRunner.query(`ALTER TABLE "health_records" DROP CONSTRAINT "FK_3f0ddc85e70c567d05c28ba50f8"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_4d2ce22525e1801b449f24a9898"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_9f49987820da519f855d04c82bd"`);
        await queryRunner.query(`ALTER TABLE "doctors" DROP CONSTRAINT "FK_653c27d1b10652eb0c7bbbc4427"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_4cf26c3f972d014df5c68d503d2"`);
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_3330f054416745deaa2cc130700"`);
        await queryRunner.query(`ALTER TABLE "doctor_reviews" DROP CONSTRAINT "FK_c734e2cb2754e4a6e2651ca73d8"`);
        await queryRunner.query(`ALTER TABLE "doctor_reviews" DROP CONSTRAINT "FK_3a347abe4150a4804809d1630f8"`);
        await queryRunner.query(`ALTER TABLE "doctor_reviews" DROP CONSTRAINT "FK_38dc65a98266f746f273b5418f8"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_9389db557647131856661f7d7b5"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_2d6a1941bd705056030c2b9e07d"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_94491da15bc982f3435690fc96e"`);
        await queryRunner.query(`DROP TABLE "physical_count_items"`);
        await queryRunner.query(`DROP TABLE "physical_counts"`);
        await queryRunner.query(`DROP TYPE "public"."physical_counts_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f903f082e95c0d135a872ccd1c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_849b6b5dbcccc32b85e92cbf92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0ad27610c031739837b3d6935"`);
        await queryRunner.query(`DROP TABLE "customer_return_items"`);
        await queryRunner.query(`DROP TYPE "public"."customer_return_items_condition_enum"`);
        await queryRunner.query(`DROP TYPE "public"."customer_return_items_reason_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e419e7c5a6a3e37cfb9deafe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d053b6b07132878be609e4c914"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1db59fe80a9318928c71cff21f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_66d3706b3c80efaa7feffa46da"`);
        await queryRunner.query(`DROP TABLE "customer_returns"`);
        await queryRunner.query(`DROP TYPE "public"."customer_returns_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."customer_returns_refund_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94631628fca6c2f95bda97b0df"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_40685dfd2f588349c17b76e0e5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_75975b20aca06c5cbcfe7148ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bed9ede4e01a5a8072732a9415"`);
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP TYPE "public"."stock_movements_reason_enum"`);
        await queryRunner.query(`DROP TYPE "public"."stock_movements_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c64c96842bf9f94b3f8cd262b"`);
        await queryRunner.query(`DROP TABLE "support_tickets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a11338e9d5e1be6b05a6709733"`);
        await queryRunner.query(`DROP TABLE "services"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58f0559f303763439b0bf01a6b"`);
        await queryRunner.query(`DROP TABLE "debit_notes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b00782ddf92177eced19a0597"`);
        await queryRunner.query(`DROP TABLE "credit_notes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e4445597642c2456ebdd7e23b"`);
        await queryRunner.query(`DROP TABLE "sale_payments"`);
        await queryRunner.query(`DROP TYPE "public"."sale_payments_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c210a330b80232c29c2ad68462"`);
        await queryRunner.query(`DROP TABLE "sale_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_503618ec9ee0b5c35689ae55f6"`);
        await queryRunner.query(`DROP TABLE "sales"`);
        await queryRunner.query(`DROP TYPE "public"."sales_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e29bf849c487a41f37cc212504"`);
        await queryRunner.query(`DROP TABLE "alerts"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_alert_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af08fad7c04bb85403970afdc1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_310667f935698fcd8cb319113a"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3de9262959061210705173b97c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63ae2152fde2f6f70138d1aec0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_56866f9821fa5506e122b84ec0"`);
        await queryRunner.query(`DROP TABLE "calls"`);
        await queryRunner.query(`DROP TYPE "public"."calls_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."calls_call_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3b49e2e0edb69d0d3f320bd70"`);
        await queryRunner.query(`DROP TABLE "conversations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8584a1974e1ca95f4861d975ff"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_message_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."messages_sender_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_504f22ef54941c99b9ec9e31c3"`);
        await queryRunner.query(`DROP TABLE "message_reads"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "facilities"`);
        await queryRunner.query(`DROP TYPE "public"."facilities_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4af40b14c3057ba729bd810e8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2f68e345c05e8166ff9deea1ab"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_entity_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
        await queryRunner.query(`DROP TABLE "departments"`);
        await queryRunner.query(`DROP TABLE "stock_transfer_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fba752c32879fc788f3faaec5a"`);
        await queryRunner.query(`DROP TABLE "stock_transfers"`);
        await queryRunner.query(`DROP TYPE "public"."stock_transfers_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba88b4aac504d9b3bc05887bca"`);
        await queryRunner.query(`DROP TABLE "stocks"`);
        await queryRunner.query(`DROP TABLE "medicines"`);
        await queryRunner.query(`DROP TYPE "public"."medicines_dosage_form_enum"`);
        await queryRunner.query(`DROP TABLE "medicine_categories"`);
        await queryRunner.query(`DROP TABLE "purchase_order_items"`);
        await queryRunner.query(`DROP TABLE "purchase_orders"`);
        await queryRunner.query(`DROP TYPE "public"."purchase_orders_status_enum"`);
        await queryRunner.query(`DROP TABLE "suppliers"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
        await queryRunner.query(`DROP TYPE "public"."organizations_subscription_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."organizations_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c43843ed1d0bd2c7e2b08c610f"`);
        await queryRunner.query(`DROP TABLE "batches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41ccd4f2308af8bed045960de3"`);
        await queryRunner.query(`DROP TABLE "dispense_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."dispense_transactions_dispense_type_enum"`);
        await queryRunner.query(`DROP TABLE "health_tips"`);
        await queryRunner.query(`DROP TYPE "public"."health_tips_language_enum"`);
        await queryRunner.query(`DROP TYPE "public"."health_tips_category_enum"`);
        await queryRunner.query(`DROP TABLE "health_records"`);
        await queryRunner.query(`DROP TYPE "public"."health_records_record_type_enum"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_gateway_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_method_enum"`);
        await queryRunner.query(`DROP TABLE "doctors"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_consultation_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);
        await queryRunner.query(`DROP TABLE "doctor_reviews"`);
        await queryRunner.query(`DROP TABLE "prescriptions"`);
    }
}
