import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCostingAndConversions1771600000006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add wac_enabled to facilities
        await queryRunner.query(`ALTER TABLE "facilities" ADD COLUMN "wac_enabled" BOOLEAN DEFAULT true`);

        // 2. Create facility_medicine_configs table
        await queryRunner.query(`
            CREATE TABLE "facility_medicine_configs" (
                "id" SERIAL PRIMARY KEY,
                "facility_id" INTEGER NOT NULL REFERENCES "facilities"("id") ON DELETE CASCADE,
                "medicine_id" INTEGER NOT NULL REFERENCES "medicines"("id") ON DELETE CASCADE,
                "average_cost" DECIMAL(10,2) DEFAULT 0,
                "last_purchase_price" DECIMAL(10,2) DEFAULT 0,
                "min_stock_level" INTEGER,
                "target_stock_level" INTEGER,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Add unique index to facility_medicine_configs
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_FACILITY_MEDICINE_CONFIG" ON "facility_medicine_configs"("facility_id", "medicine_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_FACILITY_MEDICINE_CONFIG"`);
        await queryRunner.query(`DROP TABLE "facility_medicine_configs"`);
        await queryRunner.query(`ALTER TABLE "facilities" DROP COLUMN "wac_enabled"`);
    }
}
