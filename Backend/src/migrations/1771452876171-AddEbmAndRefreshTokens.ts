import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C-3: Adds mandatory RRA EBM compliance fields.
 * C-4: Adds refresh_tokens table for secure token revocation.
 * H-10: Adds critical performance indexes.
 */
export class AddEbmAndRefreshTokens1771452876171 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── C-3a: EBM mandatory fields on facilities ──────────────────────────
        await queryRunner.query(`
            ALTER TABLE facilities
                ADD COLUMN IF NOT EXISTS tin_number VARCHAR(30),
                ADD COLUMN IF NOT EXISTS ebm_device_serial VARCHAR(100),
                ADD COLUMN IF NOT EXISTS ebm_sdcid VARCHAR(100);
        `);

        // ── C-3b: Per-item tax category on sale_items (RRA requires A/B/C/D/E) ─
        await queryRunner.query(`
            ALTER TABLE sale_items
                ADD COLUMN IF NOT EXISTS tax_category VARCHAR(2) DEFAULT 'B';
            COMMENT ON COLUMN sale_items.tax_category IS
                'RRA EBM tax category: A=18%VAT, B=0%VAT, C=Exempt, D=Non-VAT, E=Export';
        `);

        // ── C-3c: Extra fields on sales needed for EBM ───────────────────────
        await queryRunner.query(`
            ALTER TABLE sales
                ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(30),
                ADD COLUMN IF NOT EXISTS ebm_receipt_number VARCHAR(100),
                ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'normal';
            COMMENT ON COLUMN sales.invoice_type IS 'normal | credit | debit';
        `);

        // ── C-3d: EBM submission retry queue ─────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS ebm_submission_queue (
                id           SERIAL PRIMARY KEY,
                sale_id      INT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                payload      JSONB NOT NULL,
                attempt_count INT DEFAULT 0,
                last_attempt_at TIMESTAMP WITH TIME ZONE,
                status       VARCHAR(20) DEFAULT 'pending',
                error_message TEXT,
                created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_ebm_queue_status ON ebm_submission_queue(status);
            COMMENT ON TABLE ebm_submission_queue IS
                'Dead-letter queue for failed RRA EBM submissions. SchedulerService retries every 15 min.';
        `);

        // ── C-4: Refresh tokens for secure revocation ────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id          SERIAL PRIMARY KEY,
                user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash  VARCHAR(64) NOT NULL UNIQUE,
                expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
                revoked_at  TIMESTAMP WITH TIME ZONE DEFAULT NULL,
                created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
            CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
        `);

        // ── H-10: Critical performance indexes ───────────────────────────────
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS idx_sale_items_medicine_id         ON sale_items(medicine_id);
            CREATE INDEX IF NOT EXISTS idx_batches_expiry_date            ON batches(expiry_date);
            CREATE INDEX IF NOT EXISTS idx_stock_movements_facility_med   ON stock_movements(facility_id, medicine_id);
            CREATE INDEX IF NOT EXISTS idx_sales_status                   ON sales(status);
            CREATE INDEX IF NOT EXISTS idx_users_facility_id              ON users(facility_id);
            CREATE INDEX IF NOT EXISTS idx_organizations_subscription     ON organizations(subscription_status);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes (H-10)
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_organizations_subscription;
            DROP INDEX IF EXISTS idx_users_facility_id;
            DROP INDEX IF EXISTS idx_sales_status;
            DROP INDEX IF EXISTS idx_stock_movements_facility_med;
            DROP INDEX IF EXISTS idx_batches_expiry_date;
            DROP INDEX IF EXISTS idx_sale_items_medicine_id;
        `);

        // Drop refresh_tokens (C-4)
        await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens;`);

        // Drop EBM queue (C-3d)
        await queryRunner.query(`DROP TABLE IF EXISTS ebm_submission_queue;`);

        // Reverse sales columns (C-3c)
        await queryRunner.query(`
            ALTER TABLE sales
                DROP COLUMN IF EXISTS invoice_type,
                DROP COLUMN IF EXISTS ebm_receipt_number,
                DROP COLUMN IF EXISTS customer_tin;
        `);

        // Reverse sale_items column (C-3b)
        await queryRunner.query(`ALTER TABLE sale_items DROP COLUMN IF EXISTS tax_category;`);

        // Reverse facilities columns (C-3a)
        await queryRunner.query(`
            ALTER TABLE facilities
                DROP COLUMN IF EXISTS ebm_sdcid,
                DROP COLUMN IF EXISTS ebm_device_serial,
                DROP COLUMN IF EXISTS tin_number;
        `);
    }
}
