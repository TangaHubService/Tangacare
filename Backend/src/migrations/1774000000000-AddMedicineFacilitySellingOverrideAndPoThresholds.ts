import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMedicineFacilitySellingOverrideAndPoThresholds1774000000000 implements MigrationInterface {
    name = 'AddMedicineFacilitySellingOverrideAndPoThresholds1774000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "medicine_facility_settings"
            ADD COLUMN IF NOT EXISTS "selling_price_override" numeric(10,2)
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "purchase_approval_thresholds" (
                "id" SERIAL NOT NULL,
                "organization_id" integer NOT NULL,
                "facility_id" integer,
                "dual_approval_above_amount" numeric(12,2),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_purchase_approval_thresholds" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_po_threshold_org_default"
            ON "purchase_approval_thresholds" ("organization_id")
            WHERE "facility_id" IS NULL
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_po_threshold_org_facility"
            ON "purchase_approval_thresholds" ("organization_id", "facility_id")
            WHERE "facility_id" IS NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "purchase_approval_thresholds"
            ADD CONSTRAINT "FK_po_threshold_org"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "purchase_approval_thresholds"
            ADD CONSTRAINT "FK_po_threshold_facility"
            FOREIGN KEY ("facility_id") REFERENCES "facilities"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "purchase_approval_thresholds"`);
        await queryRunner.query(
            `ALTER TABLE "medicine_facility_settings" DROP COLUMN IF EXISTS "selling_price_override"`,
        );
    }
}
