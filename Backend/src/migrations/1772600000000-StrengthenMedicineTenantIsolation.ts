import { MigrationInterface, QueryRunner } from 'typeorm';

export class StrengthenMedicineTenantIsolation1772600000000 implements MigrationInterface {
    name = 'StrengthenMedicineTenantIsolation1772600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "legacy_medicine_organization_reviews" (
                "id" BIGSERIAL PRIMARY KEY,
                "review_key" character varying(255) NOT NULL,
                "review_type" character varying(100) NOT NULL,
                "medicine_id" integer,
                "organization_id" integer,
                "duplicate_key_type" character varying(50),
                "duplicate_key_value" text,
                "candidate_organization_ids" jsonb,
                "conflicting_medicine_ids" jsonb,
                "evidence" jsonb,
                "notes" text,
                "status" character varying(50) NOT NULL DEFAULT 'pending',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_legacy_medicine_organization_reviews_review_key"
            ON "legacy_medicine_organization_reviews" ("review_key")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_legacy_medicine_organization_reviews_status"
            ON "legacy_medicine_organization_reviews" ("status")
        `);

        await queryRunner.query(`
            ALTER TABLE "medicines"
            ADD COLUMN IF NOT EXISTS "normalized_name" character varying(255)
        `);

        await queryRunner.query(`
            UPDATE "medicines"
            SET "normalized_name" = NULLIF(
                LOWER(BTRIM(REGEXP_REPLACE(COALESCE("name", ''), '\\s+', ' ', 'g'))),
                ''
            )
            WHERE "normalized_name" IS NULL
               OR "normalized_name" = ''
        `);

        // Remove global uniqueness so different organizations can own equivalent medicines safely.
        await queryRunner.query(`
            ALTER TABLE "medicines"
            DROP CONSTRAINT IF EXISTS "UQ_c4c9ac38aba0468688754ec2036"
        `);
        await queryRunner.query(`
            ALTER TABLE "medicines"
            DROP CONSTRAINT IF EXISTS "UQ_5b1334d794bdf0ec82799a832f7"
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_medicines_org_code_lookup"
            ON "medicines" ("organization_id", "code")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_medicines_org_barcode_lookup"
            ON "medicines" ("organization_id", "barcode")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_medicines_org_normalized_name_lookup"
            ON "medicines" ("organization_id", "normalized_name")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_medicine_categories_org_code_lookup"
            ON "medicine_categories" ("organization_id", "code")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_medicine_categories_org_name_lookup"
            ON "medicine_categories" ("organization_id", "name")
        `);

        await queryRunner.query(`
            WITH evidence AS (
                SELECT s.medicine_id, s.organization_id, 'stocks'::text AS source
                FROM "stocks" s
                WHERE s.organization_id IS NOT NULL
                UNION ALL
                SELECT b.medicine_id, b.organization_id, 'batches'::text AS source
                FROM "batches" b
                WHERE b.organization_id IS NOT NULL
                UNION ALL
                SELECT poi.medicine_id, po.organization_id, 'purchase_orders'::text AS source
                FROM "purchase_order_items" poi
                INNER JOIN "purchase_orders" po ON po.id = poi.purchase_order_id
                WHERE po.organization_id IS NOT NULL
                UNION ALL
                SELECT si.medicine_id, s.organization_id, 'sales'::text AS source
                FROM "sale_items" si
                INNER JOIN "sales" s ON s.id = si.sale_id
                WHERE s.organization_id IS NOT NULL
                UNION ALL
                SELECT dt.medicine_id, dt.organization_id, 'dispense_transactions'::text AS source
                FROM "dispense_transactions" dt
                WHERE dt.organization_id IS NOT NULL
            ),
            ambiguous AS (
                SELECT
                    m.id AS medicine_id,
                    ARRAY_AGG(DISTINCT e.organization_id ORDER BY e.organization_id) AS organization_ids,
                    JSONB_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'source', e.source,
                            'organization_id', e.organization_id
                        )
                    ) AS evidence
                FROM "medicines" m
                INNER JOIN evidence e ON e.medicine_id = m.id
                WHERE m.organization_id IS NULL
                GROUP BY m.id
                HAVING COUNT(DISTINCT e.organization_id) > 1
            )
            INSERT INTO "legacy_medicine_organization_reviews" (
                "review_key",
                "review_type",
                "medicine_id",
                "candidate_organization_ids",
                "evidence",
                "notes"
            )
            SELECT
                'ambiguous_legacy_ownership:' || ambiguous.medicine_id,
                'ambiguous_legacy_ownership',
                ambiguous.medicine_id,
                TO_JSONB(ambiguous.organization_ids),
                ambiguous.evidence,
                'Legacy medicine is referenced by more than one organization and requires manual ownership review'
            FROM ambiguous
            ON CONFLICT ("review_key") DO UPDATE
            SET
                "candidate_organization_ids" = EXCLUDED."candidate_organization_ids",
                "evidence" = EXCLUDED."evidence",
                "notes" = EXCLUDED."notes",
                "updated_at" = now()
        `);

        await queryRunner.query(`
            WITH duplicate_names AS (
                SELECT
                    m.organization_id,
                    m.normalized_name,
                    ARRAY_AGG(m.id ORDER BY m.id) AS medicine_ids
                FROM "medicines" m
                WHERE m.organization_id IS NOT NULL
                  AND m.normalized_name IS NOT NULL
                GROUP BY m.organization_id, m.normalized_name
                HAVING COUNT(*) > 1
            )
            INSERT INTO "legacy_medicine_organization_reviews" (
                "review_key",
                "review_type",
                "organization_id",
                "duplicate_key_type",
                "duplicate_key_value",
                "conflicting_medicine_ids",
                "notes"
            )
            SELECT
                'duplicate_normalized_name:' || organization_id || ':' || md5(normalized_name),
                'duplicate_normalized_name',
                organization_id,
                'normalized_name',
                normalized_name,
                TO_JSONB(medicine_ids),
                'Resolve duplicate normalized medicine names within the organization before enabling the unique index'
            FROM duplicate_names
            ON CONFLICT ("review_key") DO UPDATE
            SET
                "conflicting_medicine_ids" = EXCLUDED."conflicting_medicine_ids",
                "notes" = EXCLUDED."notes",
                "updated_at" = now()
        `);

        await queryRunner.query(`
            WITH duplicate_barcodes AS (
                SELECT
                    m.organization_id,
                    m.barcode,
                    ARRAY_AGG(m.id ORDER BY m.id) AS medicine_ids
                FROM "medicines" m
                WHERE m.organization_id IS NOT NULL
                  AND m.barcode IS NOT NULL
                  AND BTRIM(m.barcode) <> ''
                GROUP BY m.organization_id, m.barcode
                HAVING COUNT(*) > 1
            )
            INSERT INTO "legacy_medicine_organization_reviews" (
                "review_key",
                "review_type",
                "organization_id",
                "duplicate_key_type",
                "duplicate_key_value",
                "conflicting_medicine_ids",
                "notes"
            )
            SELECT
                'duplicate_barcode:' || organization_id || ':' || md5(barcode),
                'duplicate_barcode',
                organization_id,
                'barcode',
                barcode,
                TO_JSONB(medicine_ids),
                'Resolve duplicate barcodes within the organization before enabling the unique index'
            FROM duplicate_barcodes
            ON CONFLICT ("review_key") DO UPDATE
            SET
                "conflicting_medicine_ids" = EXCLUDED."conflicting_medicine_ids",
                "notes" = EXCLUDED."notes",
                "updated_at" = now()
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM "medicines"
                    WHERE "organization_id" IS NOT NULL
                    GROUP BY "organization_id", "code"
                    HAVING COUNT(*) > 1
                ) THEN
                    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicines_org_code"
                    ON "medicines" ("organization_id", "code")
                    WHERE "organization_id" IS NOT NULL AND "code" IS NOT NULL;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM "medicines"
                    WHERE "organization_id" IS NOT NULL
                      AND "barcode" IS NOT NULL
                      AND BTRIM("barcode") <> ''
                    GROUP BY "organization_id", "barcode"
                    HAVING COUNT(*) > 1
                ) THEN
                    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicines_org_barcode"
                    ON "medicines" ("organization_id", "barcode")
                    WHERE "organization_id" IS NOT NULL AND "barcode" IS NOT NULL AND BTRIM("barcode") <> '';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM "medicines"
                    WHERE "organization_id" IS NOT NULL
                      AND "normalized_name" IS NOT NULL
                    GROUP BY "organization_id", "normalized_name"
                    HAVING COUNT(*) > 1
                ) THEN
                    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicines_org_normalized_name"
                    ON "medicines" ("organization_id", "normalized_name")
                    WHERE "organization_id" IS NOT NULL AND "normalized_name" IS NOT NULL;
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM "medicine_categories"
                    WHERE "organization_id" IS NOT NULL
                      AND "code" IS NOT NULL
                    GROUP BY "organization_id", "code"
                    HAVING COUNT(*) > 1
                ) THEN
                    CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicine_categories_org_code"
                    ON "medicine_categories" ("organization_id", "code")
                    WHERE "organization_id" IS NOT NULL AND "code" IS NOT NULL;
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_medicine_categories_org_code"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_medicines_org_normalized_name"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_medicines_org_barcode"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "UQ_medicines_org_code"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medicine_categories_org_name_lookup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medicine_categories_org_code_lookup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medicines_org_normalized_name_lookup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medicines_org_barcode_lookup"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_medicines_org_code_lookup"`);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_legacy_medicine_organization_reviews_status"
        `);
        await queryRunner.query(`
            DROP INDEX IF EXISTS "UQ_legacy_medicine_organization_reviews_review_key"
        `);
        await queryRunner.query(`
            DROP TABLE IF EXISTS "legacy_medicine_organization_reviews"
        `);

        await queryRunner.query(`
            ALTER TABLE "medicines"
            DROP COLUMN IF EXISTS "normalized_name"
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM "medicines" GROUP BY "code" HAVING COUNT(*) > 1
                ) THEN
                    ALTER TABLE "medicines"
                    ADD CONSTRAINT "UQ_c4c9ac38aba0468688754ec2036" UNIQUE ("code");
                END IF;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM "medicines"
                    WHERE "barcode" IS NOT NULL
                    GROUP BY "barcode"
                    HAVING COUNT(*) > 1
                ) THEN
                    ALTER TABLE "medicines"
                    ADD CONSTRAINT "UQ_5b1334d794bdf0ec82799a832f7" UNIQUE ("barcode");
                END IF;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
    }
}
