import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingPeriodMonthsToSubscriptions1773800000000 implements MigrationInterface {
    name = 'AddBillingPeriodMonthsToSubscriptions1773800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "subscriptions"
            ADD COLUMN IF NOT EXISTS "billing_period_months" integer NOT NULL DEFAULT 1
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "subscriptions"
            DROP COLUMN IF EXISTS "billing_period_months"
        `);
    }
}

