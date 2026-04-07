import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDisposalWorkflow1771600000003 implements MigrationInterface {
    name = 'AddDisposalWorkflow1771600000003';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create Enums
        await queryRunner.query(`
            CREATE TYPE "disposal_status_enum" AS ENUM (
                'draft', 'submitted', 'approved', 'posted', 'voided'
            )
        `);

        await queryRunner.query(`
            CREATE TYPE "disposal_type_enum" AS ENUM (
                'regular', 'controlled'
            )
        `);

        await queryRunner.query(`
            CREATE TYPE "disposal_reason_enum" AS ENUM (
                'expired', 'damaged', 'recalled', 'quality_issue', 'other'
            )
        `);

        // Create disposal_requests table
        await queryRunner.query(`
            CREATE TABLE "disposal_requests" (
                "id"                  SERIAL PRIMARY KEY,
                "request_number"      VARCHAR(100) NOT NULL UNIQUE,
                "facility_id"         INTEGER NOT NULL,
                "organization_id"     INTEGER,
                "created_by_id"       INTEGER NOT NULL,
                "approved_by_id"      INTEGER,
                "witness_by_id"       INTEGER,
                "status"              "disposal_status_enum" NOT NULL DEFAULT 'draft',
                "type"                "disposal_type_enum" NOT NULL DEFAULT 'regular',
                "reason"              "disposal_reason_enum" NOT NULL DEFAULT 'other',
                "notes"               TEXT,
                "total_value"         DECIMAL(12,2) NOT NULL DEFAULT 0,
                "approved_at"         TIMESTAMP WITH TIME ZONE,
                "posted_at"           TIMESTAMP WITH TIME ZONE,
                "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updated_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_dr_facility"    FOREIGN KEY ("facility_id")    REFERENCES "facilities"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_dr_created_by"  FOREIGN KEY ("created_by_id")  REFERENCES "users"("id"),
                CONSTRAINT "fk_dr_approved_by" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id"),
                CONSTRAINT "fk_dr_witness_by"  FOREIGN KEY ("witness_by_id")  REFERENCES "users"("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "idx_dr_facility_status" ON "disposal_requests" ("facility_id", "status")`);
        await queryRunner.query(`CREATE INDEX "idx_dr_request_number"  ON "disposal_requests" ("request_number")`);
        await queryRunner.query(`CREATE INDEX "idx_dr_created_at"      ON "disposal_requests" ("created_at")`);

        // Create disposal_items table
        await queryRunner.query(`
            CREATE TABLE "disposal_items" (
                "id"                  SERIAL PRIMARY KEY,
                "disposal_request_id" INTEGER NOT NULL,
                "medicine_id"         INTEGER NOT NULL,
                "batch_id"            INTEGER NOT NULL,
                "quantity"            INTEGER NOT NULL,
                "unit_cost"           DECIMAL(10,2) NOT NULL DEFAULT 0,
                "line_value"          DECIMAL(12,2) NOT NULL DEFAULT 0,
                "notes"               TEXT,
                "created_at"          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_di_disposal_request" FOREIGN KEY ("disposal_request_id") REFERENCES "disposal_requests"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_di_medicine"         FOREIGN KEY ("medicine_id")         REFERENCES "medicines"("id"),
                CONSTRAINT "fk_di_batch"            FOREIGN KEY ("batch_id")            REFERENCES "batches"("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "idx_di_disposal_request" ON "disposal_items" ("disposal_request_id")`);
        await queryRunner.query(`CREATE INDEX "idx_di_medicine"         ON "disposal_items" ("medicine_id")`);
        await queryRunner.query(`CREATE INDEX "idx_di_batch"            ON "disposal_items" ("batch_id")`);

        // Add DISPOSAL_REQUEST to audit_logs entity_type enum
        await queryRunner.query(`
            ALTER TYPE "audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'disposal_request'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "disposal_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "disposal_requests"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "disposal_reason_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "disposal_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "disposal_status_enum"`);
    }
}
