import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleToAuditEntityType1771000000002 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if we are using postgres and if the enum exists
        // This is a raw generic way to add to enum if it exists, strict handling depends on DB driver
        // For Postgres specifically:
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_entity_type_enum" ADD VALUE IF NOT EXISTS 'sale'`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Enums cannot easily remove values in Postgres without dropping and recreating
        // We generally skip down migration for enum additions in production for safety
    }
}
