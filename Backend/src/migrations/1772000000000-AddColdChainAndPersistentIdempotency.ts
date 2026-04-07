import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddColdChainAndPersistentIdempotency1772000000000 implements MigrationInterface {
    name = 'AddColdChainAndPersistentIdempotency1772000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "idempotency_keys_status_enum" AS ENUM ('in_progress', 'completed')
        `);

        await queryRunner.query(`
            CREATE TABLE "idempotency_keys" (
                "id" SERIAL NOT NULL,
                "idempotency_key" character varying(255) NOT NULL,
                "namespace" character varying(100) NOT NULL,
                "facility_id" integer,
                "user_id" integer,
                "status" "idempotency_keys_status_enum" NOT NULL DEFAULT 'in_progress',
                "status_code" integer,
                "response_body" jsonb,
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_idempotency_keys_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_idempotency_keys_idempotency_key" UNIQUE ("idempotency_key")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_idempotency_keys_expires_at" ON "idempotency_keys" ("expires_at")
        `);

        await queryRunner.query(`
            CREATE TYPE "cold_chain_telemetry_source_enum" AS ENUM ('manual', 'sensor')
        `);

        await queryRunner.query(`
            CREATE TABLE "cold_chain_telemetry" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "storage_location_id" integer NOT NULL,
                "recorded_by_id" integer,
                "source" "cold_chain_telemetry_source_enum" NOT NULL DEFAULT 'manual',
                "temperature_c" numeric(5,2) NOT NULL,
                "humidity_percent" numeric(5,2),
                "expected_min_c" numeric(5,2) NOT NULL,
                "expected_max_c" numeric(5,2) NOT NULL,
                "within_range" boolean NOT NULL,
                "notes" text,
                "recorded_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_cold_chain_telemetry_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_cold_chain_telemetry_facility_location_recorded" ON "cold_chain_telemetry" ("facility_id", "storage_location_id", "recorded_at")
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_telemetry"
            ADD CONSTRAINT "FK_cold_chain_telemetry_facility"
            FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_telemetry"
            ADD CONSTRAINT "FK_cold_chain_telemetry_location"
            FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_telemetry"
            ADD CONSTRAINT "FK_cold_chain_telemetry_recorded_by"
            FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            CREATE TYPE "cold_chain_excursions_status_enum" AS ENUM ('open', 'acknowledged', 'resolved')
        `);

        await queryRunner.query(`
            CREATE TABLE "cold_chain_excursions" (
                "id" SERIAL NOT NULL,
                "facility_id" integer NOT NULL,
                "storage_location_id" integer NOT NULL,
                "status" "cold_chain_excursions_status_enum" NOT NULL DEFAULT 'open',
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "last_observed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "recovered_at" TIMESTAMP WITH TIME ZONE,
                "resolved_at" TIMESTAMP WITH TIME ZONE,
                "opened_by_id" integer,
                "acknowledged_by_id" integer,
                "resolved_by_id" integer,
                "highest_temperature_c" numeric(5,2) NOT NULL,
                "lowest_temperature_c" numeric(5,2) NOT NULL,
                "last_temperature_c" numeric(5,2) NOT NULL,
                "expected_min_c" numeric(5,2) NOT NULL,
                "expected_max_c" numeric(5,2) NOT NULL,
                "resolution_action" character varying(160),
                "resolution_notes" text,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_cold_chain_excursions_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_cold_chain_excursions_facility_location_status" ON "cold_chain_excursions" ("facility_id", "storage_location_id", "status")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_cold_chain_excursions_started_at" ON "cold_chain_excursions" ("started_at")
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_excursions"
            ADD CONSTRAINT "FK_cold_chain_excursions_facility"
            FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_excursions"
            ADD CONSTRAINT "FK_cold_chain_excursions_location"
            FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id") ON DELETE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_excursions"
            ADD CONSTRAINT "FK_cold_chain_excursions_opened_by"
            FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_excursions"
            ADD CONSTRAINT "FK_cold_chain_excursions_acknowledged_by"
            FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "cold_chain_excursions"
            ADD CONSTRAINT "FK_cold_chain_excursions_resolved_by"
            FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cold_chain_excursions" DROP CONSTRAINT "FK_cold_chain_excursions_resolved_by"`);
        await queryRunner.query(`ALTER TABLE "cold_chain_excursions" DROP CONSTRAINT "FK_cold_chain_excursions_acknowledged_by"`);
        await queryRunner.query(`ALTER TABLE "cold_chain_excursions" DROP CONSTRAINT "FK_cold_chain_excursions_opened_by"`);
        await queryRunner.query(`ALTER TABLE "cold_chain_excursions" DROP CONSTRAINT "FK_cold_chain_excursions_location"`);
        await queryRunner.query(`ALTER TABLE "cold_chain_excursions" DROP CONSTRAINT "FK_cold_chain_excursions_facility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cold_chain_excursions_started_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cold_chain_excursions_facility_location_status"`);
        await queryRunner.query(`DROP TABLE "cold_chain_excursions"`);
        await queryRunner.query(`DROP TYPE "cold_chain_excursions_status_enum"`);

        await queryRunner.query(`ALTER TABLE "cold_chain_telemetry" DROP CONSTRAINT "FK_cold_chain_telemetry_recorded_by"`);
        await queryRunner.query(`ALTER TABLE "cold_chain_telemetry" DROP CONSTRAINT "FK_cold_chain_telemetry_location"`);
        await queryRunner.query(`ALTER TABLE "cold_chain_telemetry" DROP CONSTRAINT "FK_cold_chain_telemetry_facility"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cold_chain_telemetry_facility_location_recorded"`);
        await queryRunner.query(`DROP TABLE "cold_chain_telemetry"`);
        await queryRunner.query(`DROP TYPE "cold_chain_telemetry_source_enum"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_idempotency_keys_expires_at"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP TYPE "idempotency_keys_status_enum"`);
    }
}
