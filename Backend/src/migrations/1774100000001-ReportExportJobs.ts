import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportExportJobs1774100000001 implements MigrationInterface {
    name = 'ReportExportJobs1774100000001';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "report_export_jobs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "organization_id" integer NOT NULL,
                "facility_id" integer NOT NULL,
                "created_by_id" integer,
                "report_type" character varying(64) NOT NULL,
                "format" character varying(16) NOT NULL,
                "status" character varying(24) NOT NULL DEFAULT 'pending',
                "query" jsonb,
                "file_path" text,
                "error_message" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "completed_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_report_export_jobs" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_report_export_jobs_org_facility" ON "report_export_jobs" ("organization_id", "facility_id")`,
        );
        await queryRunner.query(`
            ALTER TABLE "report_export_jobs"
            ADD CONSTRAINT "FK_report_export_jobs_organization"
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "report_export_jobs"
            ADD CONSTRAINT "FK_report_export_jobs_facility"
            FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "report_export_jobs"`);
    }
}
