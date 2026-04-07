import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVendorReturns1771600000001 implements MigrationInterface {
    name = 'AddVendorReturns1771600000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create vendor_returns table
        await queryRunner.query(`
            CREATE TYPE "vendor_return_status_enum" AS ENUM (
                'pending', 'approved', 'rejected', 'completed'
            )
        `);

        await queryRunner.query(`
            CREATE TYPE "vendor_return_reason_enum" AS ENUM (
                'expired', 'damaged_arrival', 'wrong_item', 'overstocked', 'quality_issue', 'other'
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "vendor_returns" (
                "id"                  SERIAL PRIMARY KEY,
                "return_number"       VARCHAR(100) NOT NULL UNIQUE,
                "facility_id"         INTEGER NOT NULL,
                "organization_id"     INTEGER,
                "purchase_order_id"   INTEGER,
                "supplier_id"         INTEGER NOT NULL,
                "created_by_id"       INTEGER NOT NULL,
                "approved_by_id"      INTEGER,
                "status"              "vendor_return_status_enum" NOT NULL DEFAULT 'pending',
                "total_credit_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
                "credit_note_number"  VARCHAR(100),
                "reason"              TEXT,
                "notes"               TEXT,
                "approved_at"         TIMESTAMP WITH TIME ZONE,
                "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updated_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_vr_facility"       FOREIGN KEY ("facility_id")       REFERENCES "facilities"("id")       ON DELETE CASCADE,
                CONSTRAINT "fk_vr_supplier"       FOREIGN KEY ("supplier_id")       REFERENCES "suppliers"("id"),
                CONSTRAINT "fk_vr_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")  ON DELETE SET NULL,
                CONSTRAINT "fk_vr_created_by"     FOREIGN KEY ("created_by_id")     REFERENCES "users"("id"),
                CONSTRAINT "fk_vr_approved_by"    FOREIGN KEY ("approved_by_id")    REFERENCES "users"("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "idx_vr_facility_status" ON "vendor_returns" ("facility_id", "status")`);
        await queryRunner.query(`CREATE INDEX "idx_vr_purchase_order" ON "vendor_returns" ("purchase_order_id")`);
        await queryRunner.query(`CREATE INDEX "idx_vr_supplier"       ON "vendor_returns" ("supplier_id")`);
        await queryRunner.query(`CREATE INDEX "idx_vr_created_at"     ON "vendor_returns" ("created_at")`);

        // Create vendor_return_items table
        await queryRunner.query(`
            CREATE TABLE "vendor_return_items" (
                "id"                  SERIAL PRIMARY KEY,
                "vendor_return_id"    INTEGER NOT NULL,
                "medicine_id"         INTEGER NOT NULL,
                "batch_id"            INTEGER NOT NULL,
                "quantity_returned"   INTEGER NOT NULL,
                "unit_cost"           DECIMAL(10,2) NOT NULL DEFAULT 0,
                "line_credit_amount"  DECIMAL(10,2) NOT NULL DEFAULT 0,
                "reason"              "vendor_return_reason_enum" NOT NULL DEFAULT 'other',
                "notes"               TEXT,
                "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_vri_vendor_return" FOREIGN KEY ("vendor_return_id") REFERENCES "vendor_returns"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_vri_medicine"      FOREIGN KEY ("medicine_id")      REFERENCES "medicines"("id"),
                CONSTRAINT "fk_vri_batch"         FOREIGN KEY ("batch_id")         REFERENCES "batches"("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "idx_vri_vendor_return" ON "vendor_return_items" ("vendor_return_id")`);
        await queryRunner.query(`CREATE INDEX "idx_vri_medicine"      ON "vendor_return_items" ("medicine_id")`);
        await queryRunner.query(`CREATE INDEX "idx_vri_batch"         ON "vendor_return_items" ("batch_id")`);

        // Add VENDOR_RETURN to audit_logs entity_type enum
        await queryRunner.query(`
            ALTER TYPE "audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'vendor_return'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_return_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_returns"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_return_reason_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_return_status_enum"`);
        // Note: PostgreSQL does not support removing enum values; 'vendor_return' remains in audit enum on rollback.
    }
}
