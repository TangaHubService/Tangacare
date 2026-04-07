/**
 * Seeds the TypeORM migrations table with records for migrations that were
 * already applied manually or before migrations were tracked.
 * Plain JS version for production (does not require ts-node).
 *
 * Usage: node scripts/seed-migrations-table.js
 */
const dotenv = require('dotenv');
const { DataSource } = require('typeorm');

dotenv.config();

const MIGRATIONS_ALREADY_APPLIED = [
    { timestamp: 1700000000000, name: 'InitialBaseline1700000000000' },
    { timestamp: 1738584253000, name: 'AddAnalyticsFields1738584253000' },
    { timestamp: 1738590000000, name: 'Phase3SchemaUpdate1738590000000' },
    { timestamp: 1768297041150, name: 'AddSoftDeleteToUser1768297041150' },
    { timestamp: 1768337261896, name: 'CreateChatTables1768337261896' },
    { timestamp: 1768558353452, name: 'CreateCallEntity1768558353452' },
    { timestamp: 1768670453967, name: 'AddOtpFieldsToUser1768670453967' },
    { timestamp: 1768687168531, name: 'MakePhoneNumberNullable1768687168531' },
    { timestamp: 1768862135689, name: 'AddFacilityIdToUserAndSupplier1768862135689' },
    { timestamp: 1769000000000, name: 'CreateSalesTables1769000000000' },
    { timestamp: 1769000000001, name: 'AddBarcodeToMedicines1769000000001' },
    { timestamp: 1769000000002, name: 'AddDiscountVatToPurchaseOrders1769000000002' },
    { timestamp: 1769000000003, name: 'AddMarkupPercentToMedicines1769000000003' },
    { timestamp: 1769000000004, name: 'CreateOrganizationsAndAddOrgId1769000000004' },
    { timestamp: 1769000000005, name: 'AddOwnerAndCashierRoles1769000000005' },
    { timestamp: 1769000000006, name: 'MedicineCategoryAndPricing1769000000006' },
    { timestamp: 1769000000007, name: 'FiscalAndCreditDebitNotes1769000000007' },
    { timestamp: 1769000000008, name: 'CreateServicesTable1769000000008' },
    { timestamp: 1769000000009, name: 'CreateSupportTickets1769000000009' },
    { timestamp: 1769000000010, name: 'AddMustSetPasswordToUser1769000000010' },
    { timestamp: 1769000000011, name: 'AddOrgIdAndSoftDelete1769000000011' },
    { timestamp: 1769100000000, name: 'UpdateNotificationEnum1769100000000' },
    { timestamp: 1769200000001, name: 'AddBatchIdToStockMovements1769200000001' },
    { timestamp: 1769300000000, name: 'CreateCustomerReturnsTables1769300000000' },
    { timestamp: 1769300000001, name: 'AddUnitCostToSaleItems1769300000001' },
    { timestamp: 1769300000002, name: 'AddSalesReportIndexes1769300000002' },
    { timestamp: 1770640636179, name: 'AddResolvedByToAlert1770640636179' },
    { timestamp: 1770643580288, name: 'AddSoftDeleteToStock1770643580288' },
    { timestamp: 1770644467416, name: 'AddPartialSalesToMedicine1770644467416' },
    { timestamp: 1770644736580, name: 'AddReasonToStockMovement1770644736580' },
];

async function seed() {
    const dataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'tangacare',
    });

    await dataSource.initialize();

    const tableName = 'migrations';

    // Ensure migrations table exists
    await dataSource.query(`CREATE TABLE IF NOT EXISTS "${tableName}" ("id" SERIAL PRIMARY KEY, "timestamp" bigint NOT NULL, "name" varchar(255) NOT NULL)`);

    let inserted = 0;

    for (const row of MIGRATIONS_ALREADY_APPLIED) {
        const existing = await dataSource.query(
            `SELECT 1 FROM "${tableName}" WHERE "timestamp" = $1 AND "name" = $2`,
            [row.timestamp, row.name]
        );
        if (existing.length === 0) {
            await dataSource.query(
                `INSERT INTO "${tableName}" ("timestamp", "name") VALUES ($1, $2)`,
                [row.timestamp, row.name]
            );
            inserted++;
            console.log(`  Inserted: ${row.name}`);
        }
    }

    await dataSource.destroy();
    console.log(`\nDone. Inserted ${inserted} migration record(s).`);
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
