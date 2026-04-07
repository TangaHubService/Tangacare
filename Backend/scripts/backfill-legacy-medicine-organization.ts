import { AppDataSource } from '../src/config/database';

async function main(): Promise<void> {
    await AppDataSource.initialize();
    const queryRunner = AppDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        await queryRunner.query(`
            UPDATE "medicines"
            SET "normalized_name" = NULLIF(
                LOWER(BTRIM(REGEXP_REPLACE(COALESCE("name", ''), '\\s+', ' ', 'g'))),
                ''
            )
            WHERE "normalized_name" IS NULL
               OR "normalized_name" = ''
        `);

        const assignedRows = await queryRunner.query(`
            WITH evidence AS (
                SELECT s.medicine_id, s.organization_id
                FROM "stocks" s
                WHERE s.organization_id IS NOT NULL
                UNION ALL
                SELECT b.medicine_id, b.organization_id
                FROM "batches" b
                WHERE b.organization_id IS NOT NULL
                UNION ALL
                SELECT poi.medicine_id, po.organization_id
                FROM "purchase_order_items" poi
                INNER JOIN "purchase_orders" po ON po.id = poi.purchase_order_id
                WHERE po.organization_id IS NOT NULL
                UNION ALL
                SELECT si.medicine_id, s.organization_id
                FROM "sale_items" si
                INNER JOIN "sales" s ON s.id = si.sale_id
                WHERE s.organization_id IS NOT NULL
                UNION ALL
                SELECT dt.medicine_id, dt.organization_id
                FROM "dispense_transactions" dt
                WHERE dt.organization_id IS NOT NULL
            ),
            deterministic AS (
                SELECT
                    m.id AS medicine_id,
                    MIN(e.organization_id) AS organization_id
                FROM "medicines" m
                INNER JOIN evidence e ON e.medicine_id = m.id
                WHERE m.organization_id IS NULL
                GROUP BY m.id
                HAVING COUNT(DISTINCT e.organization_id) = 1
            )
            UPDATE "medicines" m
            SET "organization_id" = deterministic.organization_id
            FROM deterministic
            WHERE m.id = deterministic.medicine_id
            RETURNING m.id, m.organization_id
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
            WITH evidence AS (
                SELECT s.medicine_id
                FROM "stocks" s
                WHERE s.organization_id IS NOT NULL
                UNION
                SELECT b.medicine_id
                FROM "batches" b
                WHERE b.organization_id IS NOT NULL
                UNION
                SELECT poi.medicine_id
                FROM "purchase_order_items" poi
                INNER JOIN "purchase_orders" po ON po.id = poi.purchase_order_id
                WHERE po.organization_id IS NOT NULL
                UNION
                SELECT si.medicine_id
                FROM "sale_items" si
                INNER JOIN "sales" s ON s.id = si.sale_id
                WHERE s.organization_id IS NOT NULL
                UNION
                SELECT dt.medicine_id
                FROM "dispense_transactions" dt
                WHERE dt.organization_id IS NOT NULL
            ),
            unresolved AS (
                SELECT m.id AS medicine_id
                FROM "medicines" m
                LEFT JOIN evidence e ON e.medicine_id = m.id
                WHERE m.organization_id IS NULL
                GROUP BY m.id
                HAVING COUNT(e.medicine_id) = 0
            )
            INSERT INTO "legacy_medicine_organization_reviews" (
                "review_key",
                "review_type",
                "medicine_id",
                "notes"
            )
            SELECT
                'unresolved_legacy_ownership:' || unresolved.medicine_id,
                'unresolved_legacy_ownership',
                unresolved.medicine_id,
                'Legacy medicine has no deterministic organization evidence and requires manual review'
            FROM unresolved
            ON CONFLICT ("review_key") DO UPDATE
            SET
                "notes" = EXCLUDED."notes",
                "updated_at" = now()
        `);

        const duplicateNameRows = await queryRunner.query(`
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
            RETURNING 1
        `);

        const duplicateBarcodeRows = await queryRunner.query(`
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
            RETURNING 1
        `);

        const ambiguousCountRows = await queryRunner.query(`
            SELECT COUNT(*)::int AS count
            FROM "legacy_medicine_organization_reviews"
            WHERE "status" = 'pending'
              AND "review_type" = 'ambiguous_legacy_ownership'
        `);

        const unresolvedCountRows = await queryRunner.query(`
            SELECT COUNT(*)::int AS count
            FROM "legacy_medicine_organization_reviews"
            WHERE "status" = 'pending'
              AND "review_type" = 'unresolved_legacy_ownership'
        `);

        const duplicateCountRows = await queryRunner.query(`
            SELECT COUNT(*)::int AS count
            FROM "legacy_medicine_organization_reviews"
            WHERE "status" = 'pending'
              AND "review_type" IN ('duplicate_normalized_name', 'duplicate_barcode')
        `);

        const duplicateReviewCount =
            Number(duplicateCountRows[0]?.count || 0);

        if (duplicateReviewCount === 0) {
            await queryRunner.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicines_org_normalized_name"
                ON "medicines" ("organization_id", "normalized_name")
                WHERE "organization_id" IS NOT NULL AND "normalized_name" IS NOT NULL
            `);
            await queryRunner.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicines_org_barcode"
                ON "medicines" ("organization_id", "barcode")
                WHERE "organization_id" IS NOT NULL AND "barcode" IS NOT NULL AND BTRIM("barcode") <> ''
            `);
            await queryRunner.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "UQ_medicine_categories_org_code"
                ON "medicine_categories" ("organization_id", "code")
                WHERE "organization_id" IS NOT NULL AND "code" IS NOT NULL
            `);
        }

        await queryRunner.commitTransaction();

        const summary = {
            assigned_to_single_organization: assignedRows.length,
            pending_ambiguous_reviews: Number(ambiguousCountRows[0]?.count || 0),
            pending_unresolved_reviews: Number(unresolvedCountRows[0]?.count || 0),
            duplicate_name_review_groups: duplicateNameRows.length,
            duplicate_barcode_review_groups: duplicateBarcodeRows.length,
            unique_indexes_ready: duplicateReviewCount === 0,
        };

        console.log(JSON.stringify(summary, null, 2));
    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error(
            JSON.stringify(
                {
                    error: {
                        name: error?.name || 'Error',
                        message: error?.message || 'Unknown error',
                    },
                },
                null,
                2,
            ),
        );
        process.exitCode = 1;
    } finally {
        await queryRunner.release();
        await AppDataSource.destroy();
    }
}

void main();
