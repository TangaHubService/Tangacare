import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastNotifiedAtAndSeverityToAlerts1771000000004 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add last_notified_at column (nullable timestamp) - idempotent with IF NOT EXISTS
        await queryRunner.query(
            `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "last_notified_at" TIMESTAMP WITH TIME ZONE`,
        );

        // Add severity column (varchar with default 'info') - idempotent with IF NOT EXISTS
        await queryRunner.query(
            `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "severity" character varying(20) NOT NULL DEFAULT 'info'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop columns if they exist (idempotent)
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "severity"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "last_notified_at"`);
    }
}
