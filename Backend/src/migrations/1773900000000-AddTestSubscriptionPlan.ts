import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTestSubscriptionPlan1773900000000 implements MigrationInterface {
    name = 'AddTestSubscriptionPlan1773900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "subscription_plans" (plan_code, name, price_rwf_monthly, trial_days, max_users, max_facilities)
            VALUES ('test', 'Test Plan', 100, 0, 1, 1)
            ON CONFLICT (plan_code) DO UPDATE
            SET
                name = EXCLUDED.name,
                price_rwf_monthly = EXCLUDED.price_rwf_monthly,
                trial_days = EXCLUDED.trial_days,
                max_users = EXCLUDED.max_users,
                max_facilities = EXCLUDED.max_facilities
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "subscription_plans" WHERE "plan_code" = 'test'`);
    }
}

