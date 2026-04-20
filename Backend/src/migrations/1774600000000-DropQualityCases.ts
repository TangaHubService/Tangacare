import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropQualityCases1774600000000 implements MigrationInterface {
    name = 'DropQualityCases1774600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "quality_cases"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."quality_cases_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."quality_cases_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."quality_cases_type_enum" AS ENUM('complaint', 'capa', 'adr');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."quality_cases_status_enum" AS ENUM('open', 'investigating', 'closed');
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "quality_cases" (
                "id" SERIAL NOT NULL,
                "organization_id" integer NOT NULL,
                "facility_id" integer,
                "type" "public"."quality_cases_type_enum" NOT NULL,
                "status" "public"."quality_cases_status_enum" NOT NULL DEFAULT 'open',
                "title" character varying(255) NOT NULL,
                "description" text NOT NULL,
                "medicine_id" integer,
                "batch_id" integer,
                "capa_actions" text,
                "reported_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "closed_at" TIMESTAMP WITH TIME ZONE,
                "created_by_id" integer,
                "updated_by_id" integer,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_quality_cases" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_cases_org" ON "quality_cases" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_quality_cases_facility" ON "quality_cases" ("facility_id")`);
    }
}
