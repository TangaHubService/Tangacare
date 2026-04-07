import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInsuranceManagement1771000000007 implements MigrationInterface {
    name = 'AddInsuranceManagement1771000000007';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Update sale_payments_method_enum
        // Note: In Postgres, ADD VALUE cannot be executed in a transaction block with other commands in some cases.
        // But TypeORM usually handles this if it's not a single transaction.
        await queryRunner.query(`ALTER TYPE "public"."sale_payments_method_enum" ADD VALUE 'insurance'`);

        // 2. Create insurance_providers table
        await queryRunner.query(`CREATE TYPE "public"."insurance_providers_type_enum" AS ENUM('PUBLIC', 'PRIVATE')`);
        await queryRunner.query(
            `CREATE TABLE "insurance_providers" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "type" "public"."insurance_providers_type_enum" NOT NULL DEFAULT 'PRIVATE', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_insurance_providers" PRIMARY KEY ("id"))`,
        );

        // 3. Create insurance_claims table
        await queryRunner.query(
            `CREATE TYPE "public"."insurance_claims_status_enum" AS ENUM('pending', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid')`,
        );
        await queryRunner.query(
            `CREATE TABLE "insurance_claims" ("id" SERIAL NOT NULL, "sale_id" integer NOT NULL, "provider_id" integer NOT NULL, "patient_insurance_number" character varying(100), "total_amount" numeric(10,2) NOT NULL, "expected_amount" numeric(10,2) NOT NULL, "copay_amount" numeric(10,2) NOT NULL DEFAULT '0', "actual_received_amount" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."insurance_claims_status_enum" NOT NULL DEFAULT 'pending', "notes" text, "submitted_at" TIMESTAMP WITH TIME ZONE, "processed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_insurance_claims_sale_id" UNIQUE ("sale_id"), CONSTRAINT "PK_insurance_claims" PRIMARY KEY ("id"))`,
        );

        // 4. Add foreign keys
        await queryRunner.query(
            `ALTER TABLE "insurance_claims" ADD CONSTRAINT "FK_insurance_claims_sale" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "insurance_claims" ADD CONSTRAINT "FK_insurance_claims_provider" FOREIGN KEY ("provider_id") REFERENCES "insurance_providers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
        );

        // 5. Add insurance-related columns to sales for DTO persistence if needed (optional but helpful for performance)
        // However, we are storing them in insurance_claims for now as per design.
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "insurance_claims" DROP CONSTRAINT "FK_insurance_claims_provider"`);
        await queryRunner.query(`ALTER TABLE "insurance_claims" DROP CONSTRAINT "FK_insurance_claims_sale"`);
        await queryRunner.query(`DROP TABLE "insurance_claims"`);
        await queryRunner.query(`DROP TYPE "public"."insurance_claims_status_enum"`);
        await queryRunner.query(`DROP TABLE "insurance_providers"`);
        await queryRunner.query(`DROP TYPE "public"."insurance_providers_type_enum"`);
    }
}
