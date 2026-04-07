import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddParReplenishment1772100000000 implements MigrationInterface {
    name = 'AddParReplenishment1772100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "department_par_levels" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "department_id" integer NOT NULL,
                "medicine_id" integer NOT NULL,
                "par_level" integer NOT NULL,
                "min_level" integer,
                "refill_to_level" integer,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_by_id" integer,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_department_par_levels_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_department_par_levels_unique" ON "department_par_levels" ("facility_id", "department_id", "medicine_id")
        `);

        await queryRunner.query(`
            ALTER TABLE "department_par_levels"
            ADD CONSTRAINT "FK_department_par_levels_facility"
            FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "department_par_levels"
            ADD CONSTRAINT "FK_department_par_levels_department"
            FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "department_par_levels"
            ADD CONSTRAINT "FK_department_par_levels_medicine"
            FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "department_par_levels"
            ADD CONSTRAINT "FK_department_par_levels_created_by"
            FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            CREATE TYPE "par_replenishment_tasks_priority_enum" AS ENUM ('low', 'medium', 'high', 'critical')
        `);

        await queryRunner.query(`
            CREATE TYPE "par_replenishment_tasks_status_enum" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled')
        `);

        await queryRunner.query(`
            CREATE TABLE "par_replenishment_tasks" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "department_id" integer NOT NULL,
                "medicine_id" integer NOT NULL,
                "current_quantity" integer NOT NULL DEFAULT 0,
                "target_quantity" integer NOT NULL,
                "suggested_quantity" integer NOT NULL,
                "priority" "par_replenishment_tasks_priority_enum" NOT NULL DEFAULT 'medium',
                "status" "par_replenishment_tasks_status_enum" NOT NULL DEFAULT 'pending',
                "generated_by_id" integer,
                "completed_by_id" integer,
                "due_at" TIMESTAMP WITH TIME ZONE,
                "notes" text,
                "completed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_par_replenishment_tasks_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_par_replenishment_tasks_facility_status_priority" ON "par_replenishment_tasks" ("facility_id", "status", "priority")
        `);

        await queryRunner.query(`
            ALTER TABLE "par_replenishment_tasks"
            ADD CONSTRAINT "FK_par_replenishment_tasks_facility"
            FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "par_replenishment_tasks"
            ADD CONSTRAINT "FK_par_replenishment_tasks_department"
            FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "par_replenishment_tasks"
            ADD CONSTRAINT "FK_par_replenishment_tasks_medicine"
            FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "par_replenishment_tasks"
            ADD CONSTRAINT "FK_par_replenishment_tasks_generated_by"
            FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "par_replenishment_tasks"
            ADD CONSTRAINT "FK_par_replenishment_tasks_completed_by"
            FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "par_replenishment_tasks" DROP CONSTRAINT "FK_par_replenishment_tasks_completed_by"`,
        );
        await queryRunner.query(
            `ALTER TABLE "par_replenishment_tasks" DROP CONSTRAINT "FK_par_replenishment_tasks_generated_by"`,
        );
        await queryRunner.query(
            `ALTER TABLE "par_replenishment_tasks" DROP CONSTRAINT "FK_par_replenishment_tasks_medicine"`,
        );
        await queryRunner.query(
            `ALTER TABLE "par_replenishment_tasks" DROP CONSTRAINT "FK_par_replenishment_tasks_department"`,
        );
        await queryRunner.query(
            `ALTER TABLE "par_replenishment_tasks" DROP CONSTRAINT "FK_par_replenishment_tasks_facility"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_par_replenishment_tasks_facility_status_priority"`);
        await queryRunner.query(`DROP TABLE "par_replenishment_tasks"`);
        await queryRunner.query(`DROP TYPE "par_replenishment_tasks_status_enum"`);
        await queryRunner.query(`DROP TYPE "par_replenishment_tasks_priority_enum"`);

        await queryRunner.query(
            `ALTER TABLE "department_par_levels" DROP CONSTRAINT "FK_department_par_levels_created_by"`,
        );
        await queryRunner.query(
            `ALTER TABLE "department_par_levels" DROP CONSTRAINT "FK_department_par_levels_medicine"`,
        );
        await queryRunner.query(
            `ALTER TABLE "department_par_levels" DROP CONSTRAINT "FK_department_par_levels_department"`,
        );
        await queryRunner.query(
            `ALTER TABLE "department_par_levels" DROP CONSTRAINT "FK_department_par_levels_facility"`,
        );
        await queryRunner.query(`DROP INDEX "public"."IDX_department_par_levels_unique"`);
        await queryRunner.query(`DROP TABLE "department_par_levels"`);
    }
}
