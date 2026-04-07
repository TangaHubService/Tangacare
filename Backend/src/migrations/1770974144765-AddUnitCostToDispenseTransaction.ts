import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitCostToDispenseTransaction1770974144765 implements MigrationInterface {
    name = 'AddUnitCostToDispenseTransaction1770974144765';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dispense_transactions" ADD "unit_cost" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT '0.18'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT 0.18`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP COLUMN "unit_cost"`);
    }
}
