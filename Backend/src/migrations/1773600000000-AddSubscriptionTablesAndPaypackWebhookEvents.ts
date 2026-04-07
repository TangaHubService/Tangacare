import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionTablesAndPaypackWebhookEvents1773600000000 implements MigrationInterface {
    name = 'AddSubscriptionTablesAndPaypackWebhookEvents1773600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$ BEGIN CREATE TYPE "public"."subscription_status_enum" AS ENUM('trialing','active','past_due','expired','cancelled');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN CREATE TYPE "public"."subscription_payment_status_enum" AS ENUM('pending','success','failed');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN CREATE TYPE "public"."subscription_payment_gateway_enum" AS ENUM('paypack');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN CREATE TYPE "public"."subscription_payment_kind_enum" AS ENUM('CASHIN');
            EXCEPTION WHEN duplicate_object THEN null; END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "subscription_plans" (
                "id" SERIAL NOT NULL,
                "plan_code" character varying(50) NOT NULL,
                "name" character varying(100) NOT NULL,
                "price_rwf_monthly" integer,
                "trial_days" integer NOT NULL DEFAULT 7,
                "max_users" integer,
                "max_facilities" integer,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscription_plans" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_subscription_plans_plan_code" UNIQUE ("plan_code")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "subscriptions" (
                "id" SERIAL NOT NULL,
                "organization_id" integer NOT NULL,
                "subscription_plan_id" integer NOT NULL,
                "status" "public"."subscription_status_enum" NOT NULL,
                "trial_end_at" TIMESTAMP WITH TIME ZONE,
                "current_period_end_at" TIMESTAMP WITH TIME ZONE,
                "next_billing_at" TIMESTAMP WITH TIME ZONE,
                "cancelled_at" TIMESTAMP WITH TIME ZONE,
                "paypack_phone_number" character varying(20) NOT NULL,
                "payment_method_preference" character varying(50),
                "billing_attempts" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscriptions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "subscription_payments" (
                "id" SERIAL NOT NULL,
                "subscription_id" integer NOT NULL,
                "amount_rwf" integer NOT NULL,
                "currency" character varying(3) NOT NULL DEFAULT 'RWF',
                "gateway" "public"."subscription_payment_gateway_enum" NOT NULL,
                "gateway_ref" character varying(100) NOT NULL,
                "status" "public"."subscription_payment_status_enum" NOT NULL DEFAULT 'pending',
                "kind" "public"."subscription_payment_kind_enum" NOT NULL DEFAULT 'CASHIN',
                "provider" character varying(50),
                "paid_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_subscription_payments" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_subscription_payments_gateway_ref" UNIQUE ("gateway_ref")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "paypack_webhook_events" (
                "id" SERIAL NOT NULL,
                "event_id" character varying(100) NOT NULL,
                "kind" character varying(100),
                "signature_valid" boolean NOT NULL DEFAULT false,
                "payload" jsonb,
                "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_paypack_webhook_events" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_paypack_webhook_events_event_id" UNIQUE ("event_id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_subscriptions_organization_id" ON "subscriptions" ("organization_id");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_subscriptions_subscription_plan_id" ON "subscriptions" ("subscription_plan_id");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_subscription_payments_subscription_id" ON "subscription_payments" ("subscription_id");
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_paypack_webhook_events_received_at" ON "paypack_webhook_events" ("received_at");
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "subscriptions"
                ADD CONSTRAINT "FK_subscriptions_organization_id"
                FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "subscriptions"
                ADD CONSTRAINT "FK_subscriptions_subscription_plan_id"
                FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "subscription_payments"
                ADD CONSTRAINT "FK_subscription_payments_subscription_id"
                FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        // Seed base plans (idempotent)
        await queryRunner.query(`
            INSERT INTO "subscription_plans" (plan_code, name, price_rwf_monthly, trial_days, max_users, max_facilities)
            VALUES
                ('starter', 'Starter', 35000, 7, 1, 1),
                ('pro', 'Pro', 75000, 7, 5, 5),
                ('business', 'Business', 100000, 7, 15, 15),
                ('enterprise', 'Enterprise', NULL, 7, NULL, NULL)
            ON CONFLICT (plan_code) DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "subscription_payments"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "paypack_webhook_events"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans"`);

        await queryRunner.query(`DO $$ BEGIN DROP TYPE "public"."subscription_payment_kind_enum"; EXCEPTION WHEN others THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN DROP TYPE "public"."subscription_payment_gateway_enum"; EXCEPTION WHEN others THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN DROP TYPE "public"."subscription_payment_status_enum"; EXCEPTION WHEN others THEN null; END $$;`);
        await queryRunner.query(`DO $$ BEGIN DROP TYPE "public"."subscription_status_enum"; EXCEPTION WHEN others THEN null; END $$;`);
    }
}

