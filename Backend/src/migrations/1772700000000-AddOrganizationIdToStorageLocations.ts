import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationIdToStorageLocations1772700000000 implements MigrationInterface {
    name = 'AddOrganizationIdToStorageLocations1772700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "organization_id" integer`);

        // Backfill from facility -> organization mapping
        await queryRunner.query(`
            UPDATE "storage_locations" sl
            SET "organization_id" = f."organization_id"
            FROM "facilities" f
            WHERE sl."facility_id" = f."id"
              AND sl."organization_id" IS NULL
        `);

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_storage_locations_organization_id" ON "storage_locations" ("organization_id")`,
        );

        // Add FK if missing (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TABLE "storage_locations"
                ADD CONSTRAINT "FK_storage_locations_organization_id"
                FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TABLE "storage_locations" DROP CONSTRAINT "FK_storage_locations_organization_id";
            EXCEPTION
                WHEN undefined_object THEN NULL;
            END $$;
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_storage_locations_organization_id"`);
        await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "organization_id"`);
    }
}

