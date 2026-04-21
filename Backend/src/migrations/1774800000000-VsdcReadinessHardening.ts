import { MigrationInterface, QueryRunner } from 'typeorm';

export class VsdcReadinessHardening1774800000000 implements MigrationInterface {
    name = 'VsdcReadinessHardening1774800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE facilities
                ADD COLUMN IF NOT EXISTS tin_number VARCHAR(30),
                ADD COLUMN IF NOT EXISTS ebm_device_serial VARCHAR(100),
                ADD COLUMN IF NOT EXISTS ebm_sdcid VARCHAR(100);
        `);

        await queryRunner.query(`
            ALTER TABLE sale_items
                ADD COLUMN IF NOT EXISTS tax_category VARCHAR(2) DEFAULT 'B';
            COMMENT ON COLUMN sale_items.tax_category IS
                'RRA tax category: A=EXEMPT, B=18% VAT, C=other.';
        `);

        await queryRunner.query(`
            ALTER TABLE sales
                ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(30),
                ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'normal',
                ADD COLUMN IF NOT EXISTS receipt_type VARCHAR(2) DEFAULT 'N',
                ADD COLUMN IF NOT EXISTS receipt_label VARCHAR(2) DEFAULT 'NS',
                ADD COLUMN IF NOT EXISTS ebm_receipt_number VARCHAR(100),
                ADD COLUMN IF NOT EXISTS vsdc_internal_data VARCHAR(128),
                ADD COLUMN IF NOT EXISTS vsdc_receipt_signature VARCHAR(128),
                ADD COLUMN IF NOT EXISTS vsdc_receipt_published_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS vsdc_sdc_id VARCHAR(64),
                ADD COLUMN IF NOT EXISTS receipt_type_counter BIGINT,
                ADD COLUMN IF NOT EXISTS receipt_global_counter BIGINT;
        `);

        await queryRunner.query(`
            ALTER TABLE credit_notes
                ADD COLUMN IF NOT EXISTS ebm_receipt_number VARCHAR(100),
                ADD COLUMN IF NOT EXISTS vsdc_internal_data VARCHAR(128),
                ADD COLUMN IF NOT EXISTS vsdc_receipt_signature VARCHAR(128),
                ADD COLUMN IF NOT EXISTS vsdc_receipt_published_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS vsdc_sdc_id VARCHAR(64);
        `);

        await queryRunner.query(`
            ALTER TABLE debit_notes
                ADD COLUMN IF NOT EXISTS ebm_receipt_number VARCHAR(100),
                ADD COLUMN IF NOT EXISTS vsdc_internal_data VARCHAR(128),
                ADD COLUMN IF NOT EXISTS vsdc_receipt_signature VARCHAR(128),
                ADD COLUMN IF NOT EXISTS vsdc_receipt_published_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS vsdc_sdc_id VARCHAR(64);
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS fiscal_receipt_counters (
                id SERIAL PRIMARY KEY,
                facility_id INT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
                receipt_label VARCHAR(2) NOT NULL,
                current_value BIGINT NOT NULL DEFAULT 0,
                last_issued_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_fiscal_receipt_counters_facility_label
                ON fiscal_receipt_counters(facility_id, receipt_label);
        `);

        await queryRunner.query(`
            ALTER TABLE ebm_submission_queue
                ADD COLUMN IF NOT EXISTS document_type VARCHAR(20) DEFAULT 'sale',
                ADD COLUMN IF NOT EXISTS document_id INT,
                ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(64),
                ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN IF NOT EXISTS locked_by VARCHAR(100),
                ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(20),
                ADD COLUMN IF NOT EXISTS last_response JSONB,
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        `);

        await queryRunner.query(`
            UPDATE ebm_submission_queue
            SET document_id = COALESCE(document_id, sale_id),
                document_type = COALESCE(document_type, 'sale')
            WHERE document_id IS NULL;
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_ebm_queue_dedupe_key
                ON ebm_submission_queue(dedupe_key)
                WHERE dedupe_key IS NOT NULL;
            CREATE INDEX IF NOT EXISTS idx_ebm_queue_retry_lookup
                ON ebm_submission_queue(status, next_attempt_at, created_at);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_ebm_queue_retry_lookup;`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_ebm_queue_dedupe_key;`);
        await queryRunner.query(`
            ALTER TABLE ebm_submission_queue
                DROP COLUMN IF EXISTS updated_at,
                DROP COLUMN IF EXISTS last_response,
                DROP COLUMN IF EXISTS last_error_code,
                DROP COLUMN IF EXISTS locked_by,
                DROP COLUMN IF EXISTS locked_at,
                DROP COLUMN IF EXISTS next_attempt_at,
                DROP COLUMN IF EXISTS dedupe_key,
                DROP COLUMN IF EXISTS document_id,
                DROP COLUMN IF EXISTS document_type;
        `);

        await queryRunner.query(`DROP INDEX IF EXISTS idx_fiscal_receipt_counters_facility_label;`);
        await queryRunner.query(`DROP TABLE IF EXISTS fiscal_receipt_counters;`);

        await queryRunner.query(`
            ALTER TABLE debit_notes
                DROP COLUMN IF EXISTS vsdc_sdc_id,
                DROP COLUMN IF EXISTS vsdc_receipt_published_at,
                DROP COLUMN IF EXISTS vsdc_receipt_signature,
                DROP COLUMN IF EXISTS vsdc_internal_data,
                DROP COLUMN IF EXISTS ebm_receipt_number;
        `);

        await queryRunner.query(`
            ALTER TABLE credit_notes
                DROP COLUMN IF EXISTS vsdc_sdc_id,
                DROP COLUMN IF EXISTS vsdc_receipt_published_at,
                DROP COLUMN IF EXISTS vsdc_receipt_signature,
                DROP COLUMN IF EXISTS vsdc_internal_data,
                DROP COLUMN IF EXISTS ebm_receipt_number;
        `);

        await queryRunner.query(`
            ALTER TABLE sales
                DROP COLUMN IF EXISTS receipt_global_counter,
                DROP COLUMN IF EXISTS receipt_type_counter,
                DROP COLUMN IF EXISTS vsdc_sdc_id,
                DROP COLUMN IF EXISTS vsdc_receipt_published_at,
                DROP COLUMN IF EXISTS vsdc_receipt_signature,
                DROP COLUMN IF EXISTS vsdc_internal_data,
                DROP COLUMN IF EXISTS ebm_receipt_number,
                DROP COLUMN IF EXISTS receipt_label,
                DROP COLUMN IF EXISTS receipt_type,
                DROP COLUMN IF EXISTS invoice_type,
                DROP COLUMN IF EXISTS customer_tin;
        `);

        await queryRunner.query(`ALTER TABLE sale_items DROP COLUMN IF EXISTS tax_category;`);

        await queryRunner.query(`
            ALTER TABLE facilities
                DROP COLUMN IF EXISTS ebm_sdcid,
                DROP COLUMN IF EXISTS ebm_device_serial,
                DROP COLUMN IF EXISTS tin_number;
        `);
    }
}
