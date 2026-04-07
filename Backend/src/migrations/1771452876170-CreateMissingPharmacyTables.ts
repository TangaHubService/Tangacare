import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMissingPharmacyTables1771452876170 implements MigrationInterface {
    name = 'CreateMissingPharmacyTables1771452876170';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create medicine_facility_settings
        await queryRunner.query(`
            CREATE TABLE "medicine_facility_settings" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "medicine_id" integer NOT NULL,
                "min_stock_level" integer,
                "reorder_point" integer,
                "target_stock_level" integer,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_medicine_facility_settings" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_facility_medicine_settings" ON "medicine_facility_settings" ("facility_id", "medicine_id")`,
        );

        // 2. Create Types for batch_recalls
        await queryRunner.query(
            `CREATE TYPE "public"."batch_recalls_reason_enum" AS ENUM('quality_issue', 'contamination', 'regulatory', 'expiry', 'counterfeit', 'other')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."batch_recalls_status_enum" AS ENUM('initiated', 'in_progress', 'completed', 'cancelled')`,
        );

        // 3. Create batch_recalls
        await queryRunner.query(`
            CREATE TABLE "batch_recalls" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "batch_id" integer NOT NULL,
                "medicine_id" integer NOT NULL,
                "recall_number" character varying(100) NOT NULL,
                "reason" "public"."batch_recalls_reason_enum" NOT NULL,
                "description" text NOT NULL,
                "status" "public"."batch_recalls_status_enum" NOT NULL DEFAULT 'initiated',
                "affected_sales_count" integer NOT NULL DEFAULT '0',
                "affected_quantity" integer NOT NULL DEFAULT '0',
                "recovered_quantity" integer NOT NULL DEFAULT '0',
                "remaining_stock" integer NOT NULL DEFAULT '0',
                "action_taken" text,
                "notes" text,
                "initiated_by_id" integer,
                "completed_by_id" integer,
                "initiated_at" TIMESTAMP NOT NULL,
                "completed_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_recall_number" UNIQUE ("recall_number"),
                CONSTRAINT "PK_batch_recalls" PRIMARY KEY ("id")
            )
        `);

        // 4. Create Types for stock_variances
        await queryRunner.query(
            `CREATE TYPE "public"."stock_variances_variance_type_enum" AS ENUM('physical_count', 'cycle_count', 'annual_count')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."stock_variances_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
        );

        // 5. Create stock_variances
        await queryRunner.query(`
            CREATE TABLE "stock_variances" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "medicine_id" integer NOT NULL,
                "batch_id" integer,
                "system_quantity" integer NOT NULL,
                "physical_quantity" integer NOT NULL,
                "variance_quantity" integer NOT NULL,
                "unit_cost" numeric(10,2),
                "variance_value" numeric(10,2),
                "variance_type" "public"."stock_variances_variance_type_enum" NOT NULL DEFAULT 'physical_count',
                "status" "public"."stock_variances_status_enum" NOT NULL DEFAULT 'pending',
                "reason" text,
                "notes" text,
                "counted_by_id" integer,
                "approved_by_id" integer,
                "approved_at" TIMESTAMP,
                "counted_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_stock_variances" PRIMARY KEY ("id")
            )
        `);

        // 6. Add Foreign Keys
        await queryRunner.query(
            `ALTER TABLE "medicine_facility_settings" ADD CONSTRAINT "FK_settings_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "medicine_facility_settings" ADD CONSTRAINT "FK_settings_medicine" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );

        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD CONSTRAINT "FK_recall_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD CONSTRAINT "FK_recall_batch" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD CONSTRAINT "FK_recall_medicine" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD CONSTRAINT "FK_recall_initiated_by" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "batch_recalls" ADD CONSTRAINT "FK_recall_completed_by" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );

        await queryRunner.query(
            `ALTER TABLE "stock_variances" ADD CONSTRAINT "FK_variance_facility" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stock_variances" ADD CONSTRAINT "FK_variance_medicine" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stock_variances" ADD CONSTRAINT "FK_variance_batch" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stock_variances" ADD CONSTRAINT "FK_variance_counted_by" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stock_variances" ADD CONSTRAINT "FK_variance_approved_by" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_variances" DROP CONSTRAINT "FK_variance_approved_by"`);
        await queryRunner.query(`ALTER TABLE "stock_variances" DROP CONSTRAINT "FK_variance_counted_by"`);
        await queryRunner.query(`ALTER TABLE "stock_variances" DROP CONSTRAINT "FK_variance_batch"`);
        await queryRunner.query(`ALTER TABLE "stock_variances" DROP CONSTRAINT "FK_variance_medicine"`);
        await queryRunner.query(`ALTER TABLE "stock_variances" DROP CONSTRAINT "FK_variance_facility"`);

        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP CONSTRAINT "FK_recall_completed_by"`);
        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP CONSTRAINT "FK_recall_initiated_by"`);
        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP CONSTRAINT "FK_recall_medicine"`);
        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP CONSTRAINT "FK_recall_batch"`);
        await queryRunner.query(`ALTER TABLE "batch_recalls" DROP CONSTRAINT "FK_recall_facility"`);

        await queryRunner.query(`ALTER TABLE "medicine_facility_settings" DROP CONSTRAINT "FK_settings_medicine"`);
        await queryRunner.query(`ALTER TABLE "medicine_facility_settings" DROP CONSTRAINT "FK_settings_facility"`);

        await queryRunner.query(`DROP TABLE "stock_variances"`);
        await queryRunner.query(`DROP TYPE "public"."stock_variances_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."stock_variances_variance_type_enum"`);

        await queryRunner.query(`DROP TABLE "batch_recalls"`);
        await queryRunner.query(`DROP TYPE "public"."batch_recalls_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."batch_recalls_reason_enum"`);

        await queryRunner.query(`DROP TABLE "medicine_facility_settings"`);
    }
}
