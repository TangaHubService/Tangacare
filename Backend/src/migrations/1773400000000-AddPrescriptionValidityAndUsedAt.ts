import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrescriptionValidityAndUsedAt1773400000000 implements MigrationInterface {
    name = 'AddPrescriptionValidityAndUsedAt1773400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "prescriptions"
            ADD COLUMN IF NOT EXISTS "validity_days" integer,
            ADD COLUMN IF NOT EXISTS "used_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "prescriptions"
            DROP COLUMN IF EXISTS "updated_at",
            DROP COLUMN IF EXISTS "used_at",
            DROP COLUMN IF EXISTS "validity_days"
        `);
    }
}
