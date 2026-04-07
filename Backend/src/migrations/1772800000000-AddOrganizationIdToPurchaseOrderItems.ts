import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationIdToPurchaseOrderItems1772800000000 implements MigrationInterface {
    name = 'AddOrganizationIdToPurchaseOrderItems1772800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "organization_id" integer`);

        // Backfill from purchase_orders.organization_id
        await queryRunner.query(`
            UPDATE "purchase_order_items" poi
            SET "organization_id" = po."organization_id"
            FROM "purchase_orders" po
            WHERE poi."purchase_order_id" = po."id"
              AND poi."organization_id" IS NULL
        `);

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_purchase_order_items_organization_id" ON "purchase_order_items" ("organization_id")`,
        );

        await queryRunner.query(`
            DO $$
            BEGIN
                ALTER TABLE "purchase_order_items"
                ADD CONSTRAINT "FK_purchase_order_items_organization_id"
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
                ALTER TABLE "purchase_order_items" DROP CONSTRAINT "FK_purchase_order_items_organization_id";
            EXCEPTION
                WHEN undefined_object THEN NULL;
            END $$;
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_purchase_order_items_organization_id"`);
        await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "organization_id"`);
    }
}

