import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenCustomerReturnWorkflow1774200000000 implements MigrationInterface {
    name = 'HardenCustomerReturnWorkflow1774200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TYPE "audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'customer_return'
        `);

        await queryRunner.query(`
            ALTER TABLE "customer_returns"
            ADD COLUMN IF NOT EXISTS "rejected_by_id" integer,
            ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP,
            ADD COLUMN IF NOT EXISTS "rejection_reason" text,
            ADD COLUMN IF NOT EXISTS "refund_processed_by_id" integer,
            ADD COLUMN IF NOT EXISTS "refund_processed_at" TIMESTAMP
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_customer_return_items_batch_id"
            ON "customer_return_items" ("batch_id")
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_returns_rejected_by') THEN
                    ALTER TABLE "customer_returns"
                    ADD CONSTRAINT "FK_customer_returns_rejected_by"
                    FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_returns_refund_processed_by') THEN
                    ALTER TABLE "customer_returns"
                    ADD CONSTRAINT "FK_customer_returns_refund_processed_by"
                    FOREIGN KEY ("refund_processed_by_id") REFERENCES "users"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_returns_credit_note') THEN
                    ALTER TABLE "customer_returns"
                    ADD CONSTRAINT "FK_customer_returns_credit_note"
                    FOREIGN KEY ("credit_note_id") REFERENCES "credit_notes"("id")
                    ON DELETE SET NULL ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_return_items_sale_item') THEN
                    ALTER TABLE "customer_return_items"
                    ADD CONSTRAINT "FK_customer_return_items_sale_item"
                    FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_return_items_medicine') THEN
                    ALTER TABLE "customer_return_items"
                    ADD CONSTRAINT "FK_customer_return_items_medicine"
                    FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_customer_return_items_batch') THEN
                    ALTER TABLE "customer_return_items"
                    ADD CONSTRAINT "FK_customer_return_items_batch"
                    FOREIGN KEY ("batch_id") REFERENCES "batches"("id")
                    ON DELETE NO ACTION ON UPDATE NO ACTION;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customer_return_items" DROP CONSTRAINT IF EXISTS "FK_customer_return_items_batch"`);
        await queryRunner.query(`ALTER TABLE "customer_return_items" DROP CONSTRAINT IF EXISTS "FK_customer_return_items_medicine"`);
        await queryRunner.query(`ALTER TABLE "customer_return_items" DROP CONSTRAINT IF EXISTS "FK_customer_return_items_sale_item"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT IF EXISTS "FK_customer_returns_credit_note"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT IF EXISTS "FK_customer_returns_refund_processed_by"`);
        await queryRunner.query(`ALTER TABLE "customer_returns" DROP CONSTRAINT IF EXISTS "FK_customer_returns_rejected_by"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_customer_return_items_batch_id"`);
        await queryRunner.query(`
            ALTER TABLE "customer_returns"
            DROP COLUMN IF EXISTS "refund_processed_at",
            DROP COLUMN IF EXISTS "refund_processed_by_id",
            DROP COLUMN IF EXISTS "rejection_reason",
            DROP COLUMN IF EXISTS "rejected_at",
            DROP COLUMN IF EXISTS "rejected_by_id"
        `);
        // PostgreSQL enum values are not removed on rollback.
    }
}
