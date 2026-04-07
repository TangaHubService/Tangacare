import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdvancedOrgFields1771577328062 implements MigrationInterface {
    name = 'AddAdvancedOrgFields1771577328062'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "organizations" ADD "legal_name" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "registration_number" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "medical_license" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "city" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "organizations" ADD "country" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT '0.18'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT 0.18`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "city"`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "medical_license"`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "registration_number"`);
        await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "legal_name"`);
    }

}
