import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogHashingAndMedicineCategory1771000000006 implements MigrationInterface {
    name = 'AddAuditLogHashingAndMedicineCategory1771000000006';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add hashing columns to audit_logs
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "hash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ADD "previous_hash" character varying(64)`);

        // Update existing audit logs with a default hash if needed
        await queryRunner.query(
            `UPDATE "audit_logs" SET "hash" = 'legacy', "previous_hash" = 'legacy' WHERE "hash" IS NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "previous_hash"`);
        await queryRunner.query(`ALTER TABLE "audit_logs" DROP COLUMN "hash"`);
    }
}
