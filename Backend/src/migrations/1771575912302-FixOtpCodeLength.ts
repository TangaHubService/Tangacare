import { MigrationInterface, QueryRunner } from "typeorm";

export class FixOtpCodeLength1771575912302 implements MigrationInterface {
    name = 'FixOtpCodeLength1771575912302'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_code"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otp_code" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT '0.18'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT 0.18`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "otp_code"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "otp_code" character varying(6)`);
    }

}
