import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlertWorkflowHistoryAndOperationalTypes1774300000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."alerts_alert_type_enum" ADD VALUE IF NOT EXISTS 'batch_recall'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."alerts_alert_type_enum" ADD VALUE IF NOT EXISTS 'stock_variance'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."alerts_alert_type_enum" ADD VALUE IF NOT EXISTS 'cold_chain_excursion'`,
        );

        await queryRunner.query(
            `ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "reference_type" character varying(80)`,
        );
        await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "reference_id" integer`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "context_data" jsonb`);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_alerts_reference_scope" ON "alerts" ("facility_id", "alert_type", "reference_type", "reference_id", "status")`,
        );

        await queryRunner.query(`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "alert_id" integer`);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_notifications_alert_created" ON "notifications" ("alert_id", "created_at")`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_alert_id" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );

        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."alert_events_event_type_enum" AS ENUM('created', 'updated', 'acknowledged', 'resolved', 'reopened', 'notified'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "alert_events" ("id" SERIAL NOT NULL, "alert_id" integer NOT NULL, "event_type" "public"."alert_events_event_type_enum" NOT NULL, "previous_status" character varying(30), "new_status" character varying(30), "actor_user_id" integer, "note" text, "payload" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_alert_events_id" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_alert_events_alert_created" ON "alert_events" ("alert_id", "created_at")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_alert_events_actor_created" ON "alert_events" ("actor_user_id", "created_at")`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alert_events" ADD CONSTRAINT "FK_alert_events_alert_id" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alert_events" ADD CONSTRAINT "FK_alert_events_actor_user_id" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );

        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."alert_delivery_logs_channel_enum" AS ENUM('in_app', 'email'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN CREATE TYPE "public"."alert_delivery_logs_status_enum" AS ENUM('sent', 'failed', 'skipped'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "alert_delivery_logs" ("id" SERIAL NOT NULL, "alert_id" integer NOT NULL, "notification_id" integer, "user_id" integer, "channel" "public"."alert_delivery_logs_channel_enum" NOT NULL, "status" "public"."alert_delivery_logs_status_enum" NOT NULL, "destination" character varying(255), "error_message" text, "payload" jsonb, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_alert_delivery_logs_id" PRIMARY KEY ("id"))`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_alert_delivery_logs_alert_created" ON "alert_delivery_logs" ("alert_id", "created_at")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_alert_delivery_logs_user_created" ON "alert_delivery_logs" ("user_id", "created_at")`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alert_delivery_logs" ADD CONSTRAINT "FK_alert_delivery_logs_alert_id" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alert_delivery_logs" ADD CONSTRAINT "FK_alert_delivery_logs_notification_id" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
        await queryRunner.query(
            `DO $$ BEGIN ALTER TABLE "alert_delivery_logs" ADD CONSTRAINT "FK_alert_delivery_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alert_delivery_logs" DROP CONSTRAINT IF EXISTS "FK_alert_delivery_logs_user_id"`);
        await queryRunner.query(
            `ALTER TABLE "alert_delivery_logs" DROP CONSTRAINT IF EXISTS "FK_alert_delivery_logs_notification_id"`,
        );
        await queryRunner.query(
            `ALTER TABLE "alert_delivery_logs" DROP CONSTRAINT IF EXISTS "FK_alert_delivery_logs_alert_id"`,
        );
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_alert_delivery_logs_user_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_alert_delivery_logs_alert_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "alert_delivery_logs"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."alert_delivery_logs_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."alert_delivery_logs_channel_enum"`);

        await queryRunner.query(`ALTER TABLE "alert_events" DROP CONSTRAINT IF EXISTS "FK_alert_events_actor_user_id"`);
        await queryRunner.query(`ALTER TABLE "alert_events" DROP CONSTRAINT IF EXISTS "FK_alert_events_alert_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_alert_events_actor_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_alert_events_alert_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "alert_events"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."alert_events_event_type_enum"`);

        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "FK_notifications_alert_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_notifications_alert_created"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP COLUMN IF EXISTS "alert_id"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_alerts_reference_scope"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "context_data"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "reference_id"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP COLUMN IF EXISTS "reference_type"`);
    }
}
