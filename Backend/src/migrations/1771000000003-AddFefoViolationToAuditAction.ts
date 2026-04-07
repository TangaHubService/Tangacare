import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFefoViolationToAuditAction1771000000003 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'fefo_violation'`,
        );
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Enums cannot easily remove values in Postgres without dropping and recreating
    }
}
