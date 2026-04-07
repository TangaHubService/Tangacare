import { MigrationInterface, QueryRunner } from 'typeorm';

export class GlobalMultiTenantBackfill1772500000000 implements MigrationInterface {
    name = 'GlobalMultiTenantBackfill1772500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add organization_id column to tables that might not have it yet from Entity sync
        const tables = [
            'stocks', 'stock_movements', 'stock_transfers', 'stock_transfer_items', 'stock_variances',
            'sales', 'sale_items', 'sale_payments', 'dispense_transactions', 'customer_returns',
            'customer_return_items', 'alerts', 'physical_counts', 'physical_count_items',
            'department_par_levels', 'par_replenishment_tasks', 'batch_recalls', 'cold_chain_excursions',
            'facility_medicine_configs', 'services', 'audit_logs', 'credit_notes', 'debit_notes',
            'insurance_claims', 'appointments', 'prescriptions'
        ];

        for (const table of tables) {
            await queryRunner.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "organization_id" integer`);
            await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_${table}_organization_id" ON "${table}" ("organization_id")`);
        }

        // 2. Backfill organization_id from facility_id joins
        const facilityLinkedTables = [
            'stocks', 'stock_movements', 'stock_transfers', 'stock_variances',
            'sales', 'dispense_transactions', 'customer_returns', 'alerts',
            'physical_counts', 'department_par_levels', 'par_replenishment_tasks',
            'batch_recalls', 'cold_chain_excursions', 'facility_medicine_configs',
            'services', 'audit_logs'
        ];

        for (const table of facilityLinkedTables) {
            await queryRunner.query(`
                UPDATE "${table}" t
                SET "organization_id" = f.organization_id
                FROM "facilities" f
                WHERE t.facility_id = f.id
                  AND t.organization_id IS NULL
                  AND f.organization_id IS NOT NULL
            `);
        }

        // 3. Backfill derived items (items linked to a parent that already has organization_id or facility_id)

        // Sale Items & Payments
        await queryRunner.query(`
            UPDATE "sale_items" si SET "organization_id" = s.organization_id FROM "sales" s WHERE si.sale_id = s.id AND si.organization_id IS NULL AND s.organization_id IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "sale_payments" sp SET "organization_id" = s.organization_id FROM "sales" s WHERE sp.sale_id = s.id AND sp.organization_id IS NULL AND s.organization_id IS NOT NULL
        `);

        // Stock Transfer Items
        await queryRunner.query(`
            UPDATE "stock_transfer_items" sti SET "organization_id" = st.organization_id FROM "stock_transfers" st WHERE sti.transfer_id = st.id AND sti.organization_id IS NULL AND st.organization_id IS NOT NULL
        `);

        // Customer Return Items
        await queryRunner.query(`
            UPDATE "customer_return_items" cri SET "organization_id" = cr.organization_id FROM "customer_returns" cr WHERE cri.return_id = cr.id AND cri.organization_id IS NULL AND cr.organization_id IS NOT NULL
        `);

        // Physical Count Items
        await queryRunner.query(`
            UPDATE "physical_count_items" pci SET "organization_id" = pc.organization_id FROM "physical_counts" pc WHERE pci.physical_count_id = pc.id AND pci.organization_id IS NULL AND pc.organization_id IS NOT NULL
        `);

        // Credit/Debit Notes
        await queryRunner.query(`
            UPDATE "credit_notes" cn SET "organization_id" = s.organization_id FROM "sales" s WHERE cn.sale_id = s.id AND cn.organization_id IS NULL AND s.organization_id IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "debit_notes" dn SET "organization_id" = s.organization_id FROM "sales" s WHERE dn.sale_id = s.id AND dn.organization_id IS NULL AND s.organization_id IS NOT NULL
        `);

        // Insurance Claims
        await queryRunner.query(`
            UPDATE "insurance_claims" ic SET "organization_id" = s.organization_id FROM "sales" s WHERE ic.sale_id = s.id AND ic.organization_id IS NULL AND s.organization_id IS NOT NULL
        `);

        // Appointments (via patient -> organization)
        await queryRunner.query(`
            UPDATE "appointments" a SET "organization_id" = u.organization_id FROM "users" u WHERE a.patient_id = u.id AND a.organization_id IS NULL AND u.organization_id IS NOT NULL
        `);

        // Prescriptions (via appointment -> organization)
        await queryRunner.query(`
            UPDATE "prescriptions" p SET "organization_id" = a.organization_id FROM "appointments" a WHERE p.appointment_id = a.id AND p.organization_id IS NULL AND a.organization_id IS NOT NULL
        `);

        // 4. Foreign Key Constraints (Safety)
        for (const table of tables) {
            await queryRunner.query(`
                DO $$ BEGIN
                    ALTER TABLE "${table}"
                    ADD CONSTRAINT "FK_${table}_organization_id"
                    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
                    ON DELETE SET NULL ON UPDATE NO ACTION;
                EXCEPTION WHEN duplicate_object THEN null;
                END $$;
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const tables = [
            'stocks', 'stock_movements', 'stock_transfers', 'stock_transfer_items', 'stock_variances',
            'sales', 'sale_items', 'sale_payments', 'dispense_transactions', 'customer_returns',
            'customer_return_items', 'alerts', 'physical_counts', 'physical_count_items',
            'department_par_levels', 'par_replenishment_tasks', 'batch_recalls', 'cold_chain_excursions',
            'facility_medicine_configs', 'services', 'audit_logs', 'credit_notes', 'debit_notes',
            'insurance_claims', 'appointments', 'prescriptions'
        ];

        for (const table of tables) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "FK_${table}_organization_id"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${table}_organization_id"`);
            await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "organization_id"`);
        }
    }
}
