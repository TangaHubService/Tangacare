import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceStorageHierarchy1770995000000 implements MigrationInterface {
    name = 'EnhanceStorageHierarchy1770995000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to storage_locations
        await queryRunner.query(`ALTER TABLE "storage_locations" ADD "parent_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "storage_locations" ADD CONSTRAINT "FK_storage_locations_parent_id" FOREIGN KEY ("parent_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL`,
        );

        // Add location_id to physical_count_items
        await queryRunner.query(`ALTER TABLE "physical_count_items" ADD "location_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "physical_count_items" ADD CONSTRAINT "FK_physical_count_items_location_id" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL`,
        );

        // Add location fields to stock_transfers
        await queryRunner.query(`ALTER TABLE "stock_transfers" ADD "from_location_id" integer`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" ADD "to_location_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_stock_transfers_from_location_id" FOREIGN KEY ("from_location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "stock_transfers" ADD CONSTRAINT "FK_stock_transfers_to_location_id" FOREIGN KEY ("to_location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL`,
        );

        // Add location_id to stock_transfer_items
        await queryRunner.query(`ALTER TABLE "stock_transfer_items" ADD "location_id" integer`);
        await queryRunner.query(
            `ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "FK_stock_transfer_items_location_id" FOREIGN KEY ("location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove from stock_transfer_items
        await queryRunner.query(
            `ALTER TABLE "stock_transfer_items" DROP CONSTRAINT "FK_stock_transfer_items_location_id"`,
        );
        await queryRunner.query(`ALTER TABLE "stock_transfer_items" DROP COLUMN "location_id"`);

        // Remove from stock_transfers
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_stock_transfers_to_location_id"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP CONSTRAINT "FK_stock_transfers_from_location_id"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP COLUMN "to_location_id"`);
        await queryRunner.query(`ALTER TABLE "stock_transfers" DROP COLUMN "from_location_id"`);

        // Remove from physical_count_items
        await queryRunner.query(
            `ALTER TABLE "physical_count_items" DROP CONSTRAINT "FK_physical_count_items_location_id"`,
        );
        await queryRunner.query(`ALTER TABLE "physical_count_items" DROP COLUMN "location_id"`);

        // Remove from storage_locations
        await queryRunner.query(`ALTER TABLE "storage_locations" DROP CONSTRAINT "FK_storage_locations_parent_id"`);
        await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN "parent_id"`);
    }
}
