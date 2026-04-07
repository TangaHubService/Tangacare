import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseOrderActivity1770980000000 implements MigrationInterface {
    name = 'AddPurchaseOrderActivity1770980000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enums if they don't exist (using IF NOT EXISTS logic block via exception handling in SQL or just try creating)
        // Since TypeORM sync usually handles this, we do it explicitly here.

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."purchase_order_activities_action_enum" AS ENUM('created', 'updated', 'approved', 'rejected', 'cancelled', 'sent', 'viewed', 'confirmed', 'clarification_requested', 'commented');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."purchase_order_activities_actor_type_enum" AS ENUM('user', 'supplier', 'system');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "purchase_order_activities" (
                "id" SERIAL NOT NULL, 
                "purchase_order_id" integer NOT NULL, 
                "action" "public"."purchase_order_activities_action_enum" NOT NULL, 
                "actor_type" "public"."purchase_order_activities_actor_type_enum" NOT NULL, 
                "user_id" integer, 
                "description" text, 
                "metadata" jsonb, 
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
                CONSTRAINT "PK_purchase_order_activities_id" PRIMARY KEY ("id")
            )
        `);

        // Add columns to purchase_orders
        await queryRunner.query(`ALTER TABLE "purchase_orders" ADD IF NOT EXISTS "token" character varying(100)`);
        await queryRunner.query(
            `ALTER TABLE "purchase_orders" ADD IF NOT EXISTS "token_expires_at" TIMESTAMP WITH TIME ZONE`,
        );
        await queryRunner.query(
            `ALTER TABLE "purchase_orders" ADD IF NOT EXISTS "is_viewed_by_supplier" boolean NOT NULL DEFAULT false`,
        );

        // Add FK
        // Check if constraint exists before adding? Or just add.
        // TypeORM usually uses specific names.

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "purchase_order_activities" 
                ADD CONSTRAINT "FK_purchase_order_activities_purchase_order_id" 
                FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "purchase_order_activities" 
                ADD CONSTRAINT "FK_purchase_order_activities_user_id" 
                FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "purchase_order_activities" DROP CONSTRAINT IF EXISTS "FK_purchase_order_activities_user_id"`,
        );
        await queryRunner.query(
            `ALTER TABLE "purchase_order_activities" DROP CONSTRAINT IF EXISTS "FK_purchase_order_activities_purchase_order_id"`,
        );

        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "is_viewed_by_supplier"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "token_expires_at"`);
        await queryRunner.query(`ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "token"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_activities"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."purchase_order_activities_actor_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."purchase_order_activities_action_enum"`);
    }
}
