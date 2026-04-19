import { MigrationInterface, QueryRunner } from 'typeorm';

export class MarketReadinessComplianceSchema1774400000001 implements MigrationInterface {
    name = 'MarketReadinessComplianceSchema1774400000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."stocks_stock_status_enum" AS ENUM('saleable', 'quarantine', 'non_saleable', 'pending_qc');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            ALTER TABLE "stocks"
            ADD COLUMN IF NOT EXISTS "stock_status" "public"."stocks_stock_status_enum" NOT NULL DEFAULT 'saleable'
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."batch_recalls_recall_class_enum" AS ENUM('class_i', 'class_ii', 'class_iii');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`ALTER TABLE "batch_recalls" ADD COLUMN IF NOT EXISTS "recall_class" "public"."batch_recalls_recall_class_enum"`);
        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD COLUMN IF NOT EXISTS "regulatory_due_at" TIMESTAMP WITH TIME ZONE`,
        );
        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD COLUMN IF NOT EXISTS "closure_reconciliation_note" text`,
        );

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."suppliers_qualification_status_enum" AS ENUM('qualified', 'pending', 'suspended');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(
            `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "qualification_status" "public"."suppliers_qualification_status_enum" NOT NULL DEFAULT 'qualified'`,
        );
        await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "qualification_expires_at" date`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "licence_document_url" character varying(512)`);

        await queryRunner.query(`ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "storage_condition_note" text`);
        await queryRunner.query(`ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "qc_pass" boolean`);
        await queryRunner.query(`ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "coa_attachment_url" character varying(512)`);

        await queryRunner.query(`ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "qc_pass" boolean`);
        await queryRunner.query(`ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "variance_quantity" integer`);
        await queryRunner.query(`ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "storage_condition_note" text`);

        await queryRunner.query(`ALTER TABLE "prescriptions" ALTER COLUMN "appointment_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ALTER COLUMN "doctor_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ALTER COLUMN "patient_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "facility_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "external_prescriber_name" character varying(255)`,
        );
        await queryRunner.query(
            `ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "external_prescriber_license" character varying(120)`,
        );
        await queryRunner.query(
            `ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "walk_in_patient_name" character varying(255)`,
        );
        await queryRunner.query(`ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "walk_in_patient_identifier" character varying(120)`);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."quality_cases_type_enum" AS ENUM('complaint', 'capa', 'adr');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."quality_cases_status_enum" AS ENUM('open', 'investigating', 'closed');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "quality_cases" (
                "id" SERIAL NOT NULL,
                "organization_id" integer NOT NULL,
                "facility_id" integer,
                "type" "public"."quality_cases_type_enum" NOT NULL,
                "status" "public"."quality_cases_status_enum" NOT NULL DEFAULT 'open',
                "title" character varying(255) NOT NULL,
                "description" text NOT NULL,
                "medicine_id" integer,
                "batch_id" integer,
                "capa_actions" text,
                "reported_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "closed_at" TIMESTAMP WITH TIME ZONE,
                "created_by_id" integer,
                "updated_by_id" integer,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_quality_cases" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_cases_org" ON "quality_cases" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_cases_facility" ON "quality_cases" ("facility_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "quality_cases"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."quality_cases_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."quality_cases_type_enum"`);

        await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "walk_in_patient_identifier"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "walk_in_patient_name"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "external_prescriber_license"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "external_prescriber_name"`);
        await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "facility_id"`);

        await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "storage_condition_note"`);
        await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "variance_quantity"`);
        await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "qc_pass"`);

        await queryRunner.query(`ALTER TABLE "goods_receipts" DROP COLUMN IF EXISTS "coa_attachment_url"`);
        await queryRunner.query(`ALTER TABLE "goods_receipts" DROP COLUMN IF EXISTS "qc_pass"`);
        await queryRunner.query(`ALTER TABLE "goods_receipts" DROP COLUMN IF EXISTS "storage_condition_note"`);

        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "licence_document_url"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "qualification_expires_at"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "qualification_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."suppliers_qualification_status_enum"`);

        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP COLUMN IF EXISTS "closure_reconciliation_note"`);
        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP COLUMN IF EXISTS "regulatory_due_at"`);
        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP COLUMN IF EXISTS "recall_class"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."batch_recalls_recall_class_enum"`);

        await queryRunner.query(`ALTER TABLE "stocks" DROP COLUMN IF EXISTS "stock_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."stocks_stock_status_enum"`);
    }
}
