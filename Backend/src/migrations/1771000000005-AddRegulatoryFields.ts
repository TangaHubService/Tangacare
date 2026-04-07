import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegulatoryFields1771000000005 implements MigrationInterface {
    name = 'AddRegulatoryFields1771000000005';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Medicine drug_schedule
        await queryRunner.query(
            `CREATE TYPE "drug_schedule_enum" AS ENUM('unclassified', 'prescription_only', 'controlled_substance_sch_ii', 'controlled_substance_sch_iii', 'controlled_substance_sch_iv', 'pharmacist_only')`,
        );
        await queryRunner.query(
            `ALTER TABLE "medicines" ADD "drug_schedule" "drug_schedule_enum" NOT NULL DEFAULT 'unclassified'`,
        );

        // User professional details
        await queryRunner.query(`ALTER TABLE "users" ADD "professional_title" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "license_number" character varying(100)`);

        // DispenseTransaction patient identification and pharmacist license
        await queryRunner.query(`ALTER TABLE "dispense_transactions" ADD "patient_id_type" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" ADD "patient_id_number" character varying(100)`);
        await queryRunner.query(
            `ALTER TABLE "dispense_transactions" ADD "dispensing_pharmacist_license" character varying(100)`,
        );

        // Add patient ID fields to sales as well for audit completeness
        await queryRunner.query(`ALTER TABLE "sales" ADD "patient_id_type" character varying(50)`);
        await queryRunner.query(`ALTER TABLE "sales" ADD "patient_id_number" character varying(100)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "patient_id_number"`);
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "patient_id_type"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP COLUMN "dispensing_pharmacist_license"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP COLUMN "patient_id_number"`);
        await queryRunner.query(`ALTER TABLE "dispense_transactions" DROP COLUMN "patient_id_type"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "license_number"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "professional_title"`);
        await queryRunner.query(`ALTER TABLE "medicines" DROP COLUMN "drug_schedule"`);
        await queryRunner.query(`DROP TYPE "drug_schedule_enum"`);
    }
}
