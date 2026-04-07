import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrgAndFacilityTaxAndLicenseFields1773200000000 implements MigrationInterface {
    name = 'AddOrgAndFacilityTaxAndLicenseFields1773200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "organizations"
            ADD COLUMN IF NOT EXISTS "tax_registration_number" character varying(100),
            ADD COLUMN IF NOT EXISTS "business_license_number" character varying(100)
        `);
        await queryRunner.query(`
            ALTER TABLE "facilities"
            ADD COLUMN IF NOT EXISTS "tax_registration_number" character varying(100)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN IF EXISTS "tax_registration_number"`);
        await queryRunner.query(`
            ALTER TABLE "organizations"
            DROP COLUMN IF EXISTS "business_license_number",
            DROP COLUMN IF EXISTS "tax_registration_number"
        `);
    }
}
