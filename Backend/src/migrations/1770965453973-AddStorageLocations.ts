import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStorageLocations1770965453973 implements MigrationInterface {
    name = 'AddStorageLocations1770965453973';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ba88b4aac504d9b3bc05887bca"`);
        await queryRunner.query(
            `CREATE TYPE "public"."storage_locations_temperature_type_enum" AS ENUM('ROOM_TEMP', 'COLD', 'FROZEN')`,
        );
        await queryRunner.query(
            `CREATE TABLE "storage_locations" ("id" SERIAL NOT NULL, "facility_id" integer NOT NULL, "name" character varying(100) NOT NULL, "code" character varying(50) NOT NULL, "area" character varying(255), "temperature_type" "public"."storage_locations_temperature_type_enum" NOT NULL DEFAULT 'ROOM_TEMP', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1f8980d88f9ebaba668dddd27cc" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_6b2611e8dd048da7b50c610534" ON "storage_locations" ("facility_id", "code") `,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."invitations_role_enum" AS ENUM('patient', 'doctor', 'admin', 'super_admin', 'facility_admin', 'owner', 'cashier', 'pharmacist', 'store_manager', 'auditor')`,
        );
        await queryRunner.query(
            `CREATE TYPE "public"."invitations_status_enum" AS ENUM('pending', 'accepted', 'expired', 'revoked')`,
        );
        await queryRunner.query(
            `CREATE TABLE "invitations" ("id" SERIAL NOT NULL, "email" character varying(255) NOT NULL, "code" character varying(100) NOT NULL, "role" "public"."invitations_role_enum" NOT NULL DEFAULT 'pharmacist', "organization_id" integer NOT NULL, "facility_id" integer, "status" "public"."invitations_status_enum" NOT NULL DEFAULT 'pending', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "invited_by_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dfcfae6af22931048ef73078418" UNIQUE ("code"), CONSTRAINT "PK_5dec98cfdfd562e4ad3648bbb07" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(`ALTER TABLE "stocks" ADD "location_id" integer`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD "location_id" integer`);

        // 1. Create a "Default Store" for every existing facility
        await queryRunner.query(`
            INSERT INTO "storage_locations" (facility_id, name, code, area, temperature_type, is_active, created_at, updated_at)
            SELECT id, 'Default Store', 'DEFAULT', 'Main Area', 'ROOM_TEMP', true, now(), now()
            FROM "facilities"
        `);

        // 2. Map existing stocks to the newly created "Default Store" of their facility
        await queryRunner.query(`
            UPDATE "stocks" s
            SET location_id = (
                SELECT id FROM "storage_locations" sl 
                WHERE sl.facility_id = s.facility_id AND sl.code = 'DEFAULT'
                LIMIT 1
            )
        `);

        // 3. Map existing stock_movements to the newly created "Default Store" of their facility
        await queryRunner.query(`
            UPDATE "stock_movements" sm
            SET location_id = (
                SELECT id FROM "storage_locations" sl 
                WHERE sl.facility_id = sm.facility_id AND sl.code = 'DEFAULT'
                LIMIT 1
            )
        `);
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT '0.18'`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_2b370ea2a8d3fa035c07820f04" ON "stocks" ("facility_id", "medicine_id", "batch_id", "department_id", "location_id") `,
        );
        await queryRunner.query(
            `CREATE INDEX "IDX_ca52adaa034e9d0e6b59ff075e" ON "stock_movements" ("location_id", "created_at") `,
        );
        await queryRunner.query(
            `ALTER TABLE "storage_locations" ADD CONSTRAINT "FK_4f5be63a042fe6ecb361186e136" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stocks" ADD CONSTRAINT "FK_9d86eedb460ad10b35d5f9c8ad0" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_d6ca14bc2db05193adbdbb2bcfe" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "invitations" ADD CONSTRAINT "FK_42d1dbb4d85dc3643fdc6560af0" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
        await queryRunner.query(
            `ALTER TABLE "invitations" ADD CONSTRAINT "FK_e36d2001ae5833f8df8f387b59d" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invitations" DROP CONSTRAINT "FK_e36d2001ae5833f8df8f387b59d"`);
        await queryRunner.query(`ALTER TABLE "invitations" DROP CONSTRAINT "FK_42d1dbb4d85dc3643fdc6560af0"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_d6ca14bc2db05193adbdbb2bcfe"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP CONSTRAINT "FK_9d86eedb460ad10b35d5f9c8ad0"`);
        await queryRunner.query(`ALTER TABLE "storage_locations" DROP CONSTRAINT "FK_4f5be63a042fe6ecb361186e136"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ca52adaa034e9d0e6b59ff075e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2b370ea2a8d3fa035c07820f04"`);
        await queryRunner.query(`ALTER TABLE "sales" ALTER COLUMN "vat_rate" SET DEFAULT 0.18`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP COLUMN "location_id"`);
        await queryRunner.query(`ALTER TABLE "stocks" DROP COLUMN "location_id"`);
        await queryRunner.query(`DROP TABLE "invitations"`);
        await queryRunner.query(`DROP TYPE "public"."invitations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invitations_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b2611e8dd048da7b50c610534"`);
        await queryRunner.query(`DROP TABLE "storage_locations"`);
        await queryRunner.query(`DROP TYPE "public"."storage_locations_temperature_type_enum"`);
        await queryRunner.query(
            `CREATE UNIQUE INDEX "IDX_ba88b4aac504d9b3bc05887bca" ON "stocks" ("facility_id", "department_id", "medicine_id", "batch_id") `,
        );
    }
}
