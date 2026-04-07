import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMedicineOrganizationScope1772400000000 implements MigrationInterface {
    name = 'AddMedicineOrganizationScope1772400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "medicines" ADD COLUMN IF NOT EXISTS "organization_id" integer`);

        // Primary backfill from stock -> facility ownership.
        await queryRunner.query(`
            UPDATE "medicines" m
            SET "organization_id" = x.organization_id
            FROM (
                SELECT s.medicine_id, MIN(f.organization_id) AS organization_id
                FROM "stocks" s
                INNER JOIN "facilities" f ON f.id = s.facility_id
                WHERE f.organization_id IS NOT NULL
                GROUP BY s.medicine_id
            ) x
            WHERE m.id = x.medicine_id
              AND m.organization_id IS NULL
        `);

        // Secondary backfill from category ownership for medicines without stock.
        await queryRunner.query(`
            UPDATE "medicines" m
            SET "organization_id" = c.organization_id
            FROM "medicine_categories" c
            WHERE m.category_id = c.id
              AND m.organization_id IS NULL
              AND c.organization_id IS NOT NULL
        `);

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_medicines_organization_id" ON "medicines" ("organization_id")`,
        );

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "medicines"
                ADD CONSTRAINT "FK_medicines_organization_id"
                FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "medicines" DROP CONSTRAINT IF EXISTS "FK_medicines_organization_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medicines_organization_id"`);
        await queryRunner.query(`ALTER TABLE "medicines" DROP COLUMN IF EXISTS "organization_id"`);
    }
}
