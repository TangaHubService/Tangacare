import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfirmedToPurchaseOrderStatus1770993424896 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."purchase_orders_status_enum" ADD VALUE 'confirmed'`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Enums cannot easily remove values in Postgres without recreating
    }
}
