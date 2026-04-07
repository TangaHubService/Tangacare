import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFacilityScopedBatchIdentity1772300000000 implements MigrationInterface {
    name = 'AddFacilityScopedBatchIdentity1772300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "facility_id" integer`);
        await queryRunner.query(`ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "organization_id" integer`);
        await queryRunner.query(`ALTER TABLE "batches" ADD COLUMN IF NOT EXISTS "supplier_id" integer`);

        // Best-effort backfill for existing rows from current stock footprint.
        await queryRunner.query(`
            UPDATE "batches" b
            SET "facility_id" = s.facility_id
            FROM (
                SELECT "batch_id", MIN("facility_id") AS facility_id
                FROM "stocks"
                GROUP BY "batch_id"
            ) s
            WHERE b.id = s.batch_id
              AND b."facility_id" IS NULL
        `);

        await queryRunner.query(`
            UPDATE "batches" b
            SET "organization_id" = f."organization_id"
            FROM "facilities" f
            WHERE b."facility_id" = f.id
              AND b."organization_id" IS NULL
        `);

        // Best-effort supplier linkage from GR -> PO chain.
        await queryRunner.query(`
            UPDATE "batches" b
            SET "supplier_id" = x.supplier_id
            FROM (
                SELECT gri."batch_id", MIN(po."supplier_id") AS supplier_id
                FROM "goods_receipt_items" gri
                JOIN "goods_receipts" gr ON gr.id = gri."goods_receipt_id"
                JOIN "purchase_orders" po ON po.id = gr."purchase_order_id"
                GROUP BY gri."batch_id"
            ) x
            WHERE b.id = x."batch_id"
              AND b."supplier_id" IS NULL
        `);

        // Fallback mapping by supplier name on legacy batches.
        await queryRunner.query(`
            UPDATE "batches" b
            SET "supplier_id" = s.id
            FROM (
                SELECT DISTINCT ON (LOWER(TRIM(name)))
                    id,
                    LOWER(TRIM(name)) AS supplier_name_key
                FROM "suppliers"
                WHERE name IS NOT NULL
                ORDER BY LOWER(TRIM(name)), id
            ) s
            WHERE b."supplier_id" IS NULL
              AND b."supplier" IS NOT NULL
              AND LOWER(TRIM(b."supplier")) = s.supplier_name_key
        `);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_c43843ed1d0bd2c7e2b08c610f"`);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_batch_facility_medicine_number_unique"
            ON "batches" ("facility_id", "medicine_id", "batch_number")
            WHERE "facility_id" IS NOT NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_batches_medicine_batch_number"
            ON "batches" ("medicine_id", "batch_number")
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_batches_facility_id" ON "batches" ("facility_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_batches_organization_id" ON "batches" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_batches_supplier_id" ON "batches" ("supplier_id")`);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "batches"
                ADD CONSTRAINT "FK_batches_facility_id"
                FOREIGN KEY ("facility_id") REFERENCES "facilities"("id")
                ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "batches"
                ADD CONSTRAINT "FK_batches_organization_id"
                FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "batches"
                ADD CONSTRAINT "FK_batches_supplier_id"
                FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
                ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "FK_batches_supplier_id"`);
        await queryRunner.query(`ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "FK_batches_organization_id"`);
        await queryRunner.query(`ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "FK_batches_facility_id"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_batches_supplier_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_batches_organization_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_batches_facility_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_batches_medicine_batch_number"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_batch_facility_medicine_number_unique"`);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_c43843ed1d0bd2c7e2b08c610f"
            ON "batches" ("medicine_id", "batch_number")
        `);

        await queryRunner.query(`ALTER TABLE "batches" DROP COLUMN IF EXISTS "supplier_id"`);
        await queryRunner.query(`ALTER TABLE "batches" DROP COLUMN IF EXISTS "organization_id"`);
        await queryRunner.query(`ALTER TABLE "batches" DROP COLUMN IF EXISTS "facility_id"`);
    }
}
