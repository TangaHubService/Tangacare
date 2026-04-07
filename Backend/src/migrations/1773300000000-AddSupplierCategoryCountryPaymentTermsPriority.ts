import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierCategoryCountryPaymentTermsPriority1773300000000 implements MigrationInterface {
    name = 'AddSupplierCategoryCountryPaymentTermsPriority1773300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "suppliers"
            ADD COLUMN IF NOT EXISTS "category" character varying(100),
            ADD COLUMN IF NOT EXISTS "country" character varying(100),
            ADD COLUMN IF NOT EXISTS "payment_terms" character varying(100),
            ADD COLUMN IF NOT EXISTS "priority" integer
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "suppliers"
            DROP COLUMN IF EXISTS "priority",
            DROP COLUMN IF EXISTS "payment_terms",
            DROP COLUMN IF EXISTS "country",
            DROP COLUMN IF EXISTS "category"
        `);
    }
}
