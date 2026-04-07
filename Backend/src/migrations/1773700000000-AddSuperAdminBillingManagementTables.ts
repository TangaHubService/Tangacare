import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSuperAdminBillingManagementTables1773700000000 implements MigrationInterface {
    name = 'AddSuperAdminBillingManagementTables1773700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN CREATE TYPE "public"."subscription_change_schedule_status_enum" AS ENUM('pending','applied','cancelled');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN CREATE TYPE "public"."payment_attempt_status_enum" AS ENUM('pending','success','failed');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "plan_features" (
                "id" SERIAL NOT NULL,
                "plan_id" integer NOT NULL,
                "key" character varying(100) NOT NULL,
                "enabled" boolean NOT NULL DEFAULT true,
                "limit_value" integer,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_plan_features" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "subscription_change_schedules" (
                "id" SERIAL NOT NULL,
                "subscription_id" integer NOT NULL,
                "from_plan_id" integer NOT NULL,
                "to_plan_id" integer NOT NULL,
                "effective_date" TIMESTAMP WITH TIME ZONE NOT NULL,
                "status" "public"."subscription_change_schedule_status_enum" NOT NULL DEFAULT 'pending',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscription_change_schedules" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "payment_attempts" (
                "id" SERIAL NOT NULL,
                "subscription_id" integer NOT NULL,
                "amount_rwf" integer NOT NULL,
                "phone_number" character varying(20) NOT NULL,
                "provider" character varying(50),
                "idempotency_key" character varying(32) NOT NULL,
                "status" "public"."payment_attempt_status_enum" NOT NULL DEFAULT 'pending',
                "failure_reason" character varying(255),
                "transaction_ref" character varying(100),
                "attempted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_payment_attempts" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "payment_gateways" (
                "id" SERIAL NOT NULL,
                "name" character varying(100) NOT NULL,
                "code" character varying(50) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "config_json" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_payment_gateways" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_payment_gateways_code" UNIQUE ("code")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "webhook_events" (
                "id" SERIAL NOT NULL,
                "gateway" character varying(50) NOT NULL,
                "event_id" character varying(100) NOT NULL,
                "event_type" character varying(100) NOT NULL,
                "signature_valid" boolean NOT NULL DEFAULT false,
                "payload" jsonb,
                "processed" boolean NOT NULL DEFAULT false,
                "processed_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_webhook_events" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_webhook_events_event_id" UNIQUE ("event_id")
            )
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_plan_features_plan_id" ON "plan_features" ("plan_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_plan_features_key" ON "plan_features" ("key")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_subscription_change_schedules_subscription_id" ON "subscription_change_schedules" ("subscription_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_attempts_subscription_id" ON "payment_attempts" ("subscription_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_payment_attempts_idempotency_key" ON "payment_attempts" ("idempotency_key")`);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "plan_features"
                ADD CONSTRAINT "FK_plan_features_plan_id"
                FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "subscription_change_schedules"
                ADD CONSTRAINT "FK_subscription_change_schedules_subscription_id"
                FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "subscription_change_schedules"
                ADD CONSTRAINT "FK_subscription_change_schedules_from_plan_id"
                FOREIGN KEY ("from_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "subscription_change_schedules"
                ADD CONSTRAINT "FK_subscription_change_schedules_to_plan_id"
                FOREIGN KEY ("to_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            INSERT INTO "payment_gateways" ("name", "code", "is_active", "config_json")
            VALUES ('Paypack', 'paypack', true, '{"mode":"development","supportedProviders":["mtn","airtel","tigo"]}'::jsonb)
            ON CONFLICT ("code") DO NOTHING
        `);

        await queryRunner.query(`
            INSERT INTO "plan_features" ("plan_id", "key", "enabled", "limit_value")
            SELECT sp.id, f.key, f.enabled, f.limit_value
            FROM "subscription_plans" sp
            JOIN (
                VALUES
                ('starter','max_users',true,1),
                ('starter','max_facilities',true,1),
                ('starter','advanced_reports',false,NULL),
                ('pro','max_users',true,5),
                ('pro','max_facilities',true,5),
                ('pro','advanced_reports',true,NULL),
                ('business','max_users',true,15),
                ('business','max_facilities',true,15),
                ('business','advanced_reports',true,NULL),
                ('enterprise','max_users',true,NULL),
                ('enterprise','max_facilities',true,NULL),
                ('enterprise','advanced_reports',true,NULL)
            ) AS f(plan_code, key, enabled, limit_value)
                ON f.plan_code = sp.plan_code
            WHERE NOT EXISTS (
                SELECT 1 FROM "plan_features" pf WHERE pf.plan_id = sp.id AND pf.key = f.key
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payment_gateways"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "payment_attempts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "subscription_change_schedules"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "plan_features"`);
        await queryRunner.query(`DO $$ BEGIN DROP TYPE "public"."payment_attempt_status_enum"; EXCEPTION WHEN others THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN DROP TYPE "public"."subscription_change_schedule_status_enum"; EXCEPTION WHEN others THEN null; END $$;`);
    }
}

