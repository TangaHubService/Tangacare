import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBackorderAndGoodsReceipt1771600000004 implements MigrationInterface {
    name = 'AddBackorderAndGoodsReceipt1771600000004';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add BACKORDERED to purchase_orders_status_enum
        await queryRunner.query(`ALTER TYPE "public"."purchase_orders_status_enum" ADD VALUE IF NOT EXISTS 'backordered'`);

        // Add backorder fields to purchase_order_items
        await queryRunner.query(`ALTER TABLE "purchase_order_items" ADD COLUMN "backorder_qty" INTEGER NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" ADD COLUMN "remaining_qty" INTEGER NOT NULL DEFAULT 0`);

        // Create goods_receipts table
        await queryRunner.query(`
            CREATE TABLE "goods_receipts" (
                "id"                SERIAL PRIMARY KEY,
                "receipt_number"    VARCHAR(100) NOT NULL UNIQUE,
                "facility_id"       INTEGER NOT NULL,
                "organization_id"   INTEGER,
                "purchase_order_id" INTEGER NOT NULL,
                "received_by_id"    INTEGER NOT NULL,
                "received_date"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "notes"             TEXT,
                "created_at"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                "updated_at"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_gr_facility"       FOREIGN KEY ("facility_id")       REFERENCES "facilities"("id")       ON DELETE CASCADE,
                CONSTRAINT "fk_gr_purchase_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id"),
                CONSTRAINT "fk_gr_received_by"    FOREIGN KEY ("received_by_id")    REFERENCES "users"("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "idx_gr_facility_date" ON "goods_receipts" ("facility_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_gr_purchase_order" ON "goods_receipts" ("purchase_order_id")`);

        // Create goods_receipt_items table
        await queryRunner.query(`
            CREATE TABLE "goods_receipt_items" (
                "id"                     SERIAL PRIMARY KEY,
                "goods_receipt_id"       INTEGER NOT NULL,
                "purchase_order_item_id" INTEGER NOT NULL,
                "medicine_id"            INTEGER NOT NULL,
                "batch_id"               INTEGER NOT NULL,
                "quantity_received"      INTEGER NOT NULL,
                "unit_cost"              DECIMAL(10,2) NOT NULL,
                "batch_number"           VARCHAR(100),
                "expiry_date"            DATE,
                "created_at"             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                CONSTRAINT "fk_gri_goods_receipt" FOREIGN KEY ("goods_receipt_id")       REFERENCES "goods_receipts"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_gri_po_item"       FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id"),
                CONSTRAINT "fk_gri_medicine"      FOREIGN KEY ("medicine_id")            REFERENCES "medicines"("id"),
                CONSTRAINT "fk_gri_batch"         FOREIGN KEY ("batch_id")               REFERENCES "batches"("id")
            )
        `);

        await queryRunner.query(`CREATE INDEX "idx_gri_goods_receipt" ON "goods_receipt_items" ("goods_receipt_id")`);
        await queryRunner.query(`CREATE INDEX "idx_gri_medicine"      ON "goods_receipt_items" ("medicine_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipt_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "goods_receipts"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN "remaining_qty"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN "backorder_qty"`);
        // Note: Enum values cannot be removed in PostgreSQL without recreating the enum.
    }
}
