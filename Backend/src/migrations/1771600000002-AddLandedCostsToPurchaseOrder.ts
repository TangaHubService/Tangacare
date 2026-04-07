import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLandedCostsToPurchaseOrder1771600000002 implements MigrationInterface {
    name = 'AddLandedCostsToPurchaseOrder1771600000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "shipping_cost"      DECIMAL(10,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "tariff_amount"      DECIMAL(10,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "handling_fee"       DECIMAL(10,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "landed_cost_total"  DECIMAL(10,2) NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "landed_cost_total"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "handling_fee"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "tariff_amount"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "shipping_cost"`);
    }
}
