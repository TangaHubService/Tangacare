import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcurementReceivingFlags1774500000000 implements MigrationInterface {
    name = 'AddProcurementReceivingFlags1774500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "purchase_order_items"
            ADD COLUMN IF NOT EXISTS "last_receipt_qc_pass" boolean,
            ADD COLUMN IF NOT EXISTS "last_receipt_variance_qty" integer
        `);

        await queryRunner.query(`
            ALTER TABLE "purchase_orders"
            ADD COLUMN IF NOT EXISTS "last_goods_receipt_id" integer
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_last_goods_receipt'
                ) THEN
                    ALTER TABLE "purchase_orders"
                    ADD CONSTRAINT "fk_po_last_goods_receipt"
                    FOREIGN KEY ("last_goods_receipt_id") REFERENCES "goods_receipts"("id")
                    ON DELETE SET NULL ON UPDATE NO ACTION;
                END IF;
            END $$
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "fk_po_last_goods_receipt"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "last_goods_receipt_id"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "last_receipt_variance_qty"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "last_receipt_qc_pass"`);
    }
}
