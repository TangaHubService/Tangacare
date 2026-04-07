import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncSellingPriceWithStockCostFloor1771900000000 implements MigrationInterface {
    name = 'SyncSellingPriceWithStockCostFloor1771900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE medicines m
            SET selling_price = src.max_unit_cost
            FROM (
                SELECT
                    medicine_id,
                    MAX(COALESCE(unit_cost, 0))::numeric(10,2) AS max_unit_cost
                FROM stocks
                WHERE is_deleted = false
                GROUP BY medicine_id
            ) src
            WHERE src.medicine_id = m.id
              AND COALESCE(m.selling_price, 0) < src.max_unit_cost
        `);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Irreversible: previous selling prices are not preserved.
    }
}
