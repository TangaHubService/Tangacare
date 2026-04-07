import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminAuditActions1772900000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'view'`);
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_action_enum" ADD VALUE IF NOT EXISTS 'impersonate'`);
        await queryRunner.query(
            `ALTER TYPE "public"."audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'organization'`,
        );
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Enums cannot easily remove values in Postgres without dropping and recreating.
    }
}

