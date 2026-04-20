import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsuranceWorkflowEnhancements1774700000000 implements MigrationInterface {
    name = 'InsuranceWorkflowEnhancements1774700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'insurance_providers' AND column_name = 'organization_id'
                ) THEN
                    ALTER TABLE "insurance_providers" ADD "organization_id" integer;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            UPDATE "insurance_providers" ip
            SET "organization_id" = sub.first_org
            FROM (
                SELECT MIN(id) AS first_org FROM "organizations"
            ) sub
            WHERE ip."organization_id" IS NULL
              AND EXISTS (SELECT 1 FROM "organizations" LIMIT 1);
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_insurance_providers_organization'
                ) THEN
                    ALTER TABLE "insurance_providers"
                    ADD CONSTRAINT "FK_insurance_providers_organization"
                    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                    ON DELETE SET NULL ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_insurance_providers_org_name" ON "insurance_providers" ("organization_id", "name")`,
        );

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'insurance_provider_id'
                ) THEN
                    ALTER TABLE "sales" ADD "insurance_provider_id" integer;
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'patient_paid_amount'
                ) THEN
                    ALTER TABLE "sales" ADD "patient_paid_amount" numeric(10,2) NOT NULL DEFAULT '0';
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'insurance_expected_amount'
                ) THEN
                    ALTER TABLE "sales" ADD "insurance_expected_amount" numeric(10,2) NOT NULL DEFAULT '0';
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'insurance_payment_status'
                ) THEN
                    ALTER TABLE "sales" ADD "insurance_payment_status" character varying(32) NOT NULL DEFAULT 'none';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_sales_insurance_provider'
                ) THEN
                    ALTER TABLE "sales"
                    ADD CONSTRAINT "FK_sales_insurance_provider"
                    FOREIGN KEY ("insurance_provider_id") REFERENCES "insurance_providers"("id")
                    ON DELETE SET NULL ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'insurance_claims' AND column_name = 'claim_number'
                ) THEN
                    ALTER TABLE "insurance_claims" ADD "claim_number" character varying(100);
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'insurance_claims' AND column_name = 'rejection_reason'
                ) THEN
                    ALTER TABLE "insurance_claims" ADD "rejection_reason" text;
                END IF;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns WHERE table_name = 'insurance_claims' AND column_name = 'approved_amount'
                ) THEN
                    ALTER TABLE "insurance_claims" ADD "approved_amount" numeric(10,2) NOT NULL DEFAULT '0';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            UPDATE "insurance_claims" ic
            SET "organization_id" = s."organization_id"
            FROM "sales" s
            WHERE ic."sale_id" = s."id"
              AND ic."organization_id" IS NULL
              AND s."organization_id" IS NOT NULL;
        `);

        await queryRunner.query(`
            UPDATE "sales" s
            SET
                "patient_paid_amount" = COALESCE((
                    SELECT SUM(sp."amount")::numeric
                    FROM "sale_payments" sp
                    WHERE sp."sale_id" = s."id"
                      AND sp."method"::text != 'insurance'
                ), 0),
                "insurance_expected_amount" = COALESCE((
                    SELECT SUM(sp."amount")::numeric
                    FROM "sale_payments" sp
                    WHERE sp."sale_id" = s."id"
                      AND sp."method"::text = 'insurance'
                ), 0),
                "insurance_provider_id" = (
                    SELECT ic."provider_id" FROM "insurance_claims" ic
                    WHERE ic."sale_id" = s."id" LIMIT 1
                ),
                "insurance_payment_status" = CASE
                    WHEN EXISTS (
                        SELECT 1 FROM "sale_payments" sp2
                        WHERE sp2."sale_id" = s."id" AND sp2."method"::text = 'insurance'
                    ) THEN
                        COALESCE((
                            SELECT CASE ic2."status"::text
                                WHEN 'paid' THEN 'received'
                                WHEN 'partially_approved' THEN 'partially_received'
                                ELSE 'pending_receipt'
                            END
                            FROM "insurance_claims" ic2
                            WHERE ic2."sale_id" = s."id" LIMIT 1
                        ), 'pending_receipt')
                    ELSE 'none'
                END;
        `);

        await queryRunner.query(`
            UPDATE "sales" s
            SET
                "paid_amount" = COALESCE((
                    SELECT SUM(sp."amount")::numeric
                    FROM "sale_payments" sp
                    WHERE sp."sale_id" = s."id"
                ), 0),
                "balance_amount" = s."total_amount" - COALESCE((
                    SELECT SUM(sp."amount")::numeric
                    FROM "sale_payments" sp
                    WHERE sp."sale_id" = s."id"
                ), 0);
        `);

        await queryRunner.query(`
            UPDATE "sales" SET "status" = CASE
                WHEN "balance_amount" <= 0 THEN 'paid'::"public"."sales_status_enum"
                WHEN "paid_amount" > 0 THEN 'partially_paid'::"public"."sales_status_enum"
                ELSE 'unpaid'::"public"."sales_status_enum"
            END
            WHERE EXISTS (SELECT 1 FROM "sale_payments" sp WHERE sp."sale_id" = "sales"."id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" DROP CONSTRAINT IF EXISTS "FK_sales_insurance_provider"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "insurance_payment_status"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "insurance_expected_amount"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "patient_paid_amount"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN IF EXISTS "insurance_provider_id"`);

        await queryRunner.query(`ALTER TABLE "insurance_claims" DROP COLUMN IF EXISTS "approved_amount"`);
        await queryRunner.query(`ALTER TABLE "insurance_claims" DROP COLUMN IF EXISTS "rejection_reason"`);
        await queryRunner.query(`ALTER TABLE "insurance_claims" DROP COLUMN IF EXISTS "claim_number"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_insurance_providers_org_name"`);
        await queryRunner.query(
            `ALTER TABLE "insurance_providers" DROP CONSTRAINT IF EXISTS "FK_insurance_providers_organization"`,
        );
        await queryRunner.query(`ALTER TABLE "insurance_providers" DROP COLUMN IF EXISTS "organization_id"`);
    }
}
