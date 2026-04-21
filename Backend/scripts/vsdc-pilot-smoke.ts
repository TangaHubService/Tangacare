/**
 * Pre-flight checks for a single-facility VSDC pilot (schema + facility seeding).
 *
 * Usage (from Backend/):
 *   PILOT_FACILITY_ID=123 yarn vsdc-pilot-smoke
 *
 * Optional (API smoke — server must be running):
 *   SMOKE_API_BASE_URL=http://localhost:3000 SMOKE_JWT='<access_token>' PILOT_FACILITY_ID=123 yarn vsdc-pilot-smoke
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { AppDataSource } from '../src/config/database';
import { Facility } from '../src/entities/Facility.entity';

const MIGRATION_COLUMNS = [
    { table: 'sales', column: 'vsdc_sdc_id' },
    { table: 'sale_items', column: 'tax_category' },
];

async function columnExists(table: string, column: string): Promise<boolean> {
    const rows = await AppDataSource.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
        [table, column],
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
    const rows = await AppDataSource.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
        [table],
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function main(): Promise<void> {
    const facilityIdRaw = process.env.PILOT_FACILITY_ID?.trim();
    if (!facilityIdRaw) {
        console.error('Set PILOT_FACILITY_ID to the pilot facility primary key.');
        process.exit(1);
    }
    const facilityId = Number(facilityIdRaw);
    if (!Number.isFinite(facilityId) || facilityId < 1) {
        console.error('PILOT_FACILITY_ID must be a positive integer.');
        process.exit(1);
    }

    await AppDataSource.initialize();

    let failed = false;

    for (const { table, column } of MIGRATION_COLUMNS) {
        const ok = await columnExists(table, column);
        if (!ok) {
            console.error(`❌ Missing column ${table}.${column} — run migrations (VsdcReadinessHardening).`);
            failed = true;
        } else {
            console.log(`✅ ${table}.${column}`);
        }
    }

    const countersOk = await tableExists('fiscal_receipt_counters');
    if (!countersOk) {
        console.error('❌ Table fiscal_receipt_counters missing — run migrations.');
        failed = true;
    } else {
        console.log('✅ fiscal_receipt_counters');
    }

    const facilityRepo = AppDataSource.getRepository(Facility);
    const facility = await facilityRepo.findOne({ where: { id: facilityId } });
    if (!facility) {
        console.error(`❌ Facility id ${facilityId} not found.`);
        failed = true;
    } else {
        console.log(`✅ Facility ${facilityId}: ${facility.name}`);
        const warnings: string[] = [];
        if (!facility.tin_number?.trim()) warnings.push('tin_number empty');
        if (!facility.ebm_device_serial?.trim()) warnings.push('ebm_device_serial empty');
        if (!facility.ebm_sdcid?.trim()) warnings.push('ebm_sdcid empty');
        if (warnings.length) {
            console.warn(`⚠️  ${warnings.join('; ')} — required for live VSDC signing.`);
        }
        if (facility.ebm_enabled !== true) {
            console.warn('⚠️  ebm_enabled is not true — fiscal submission may be skipped for this facility.');
        }
    }

    const live = process.env.RRA_EBM_ENABLED === 'true';
    if (live && !failed && facility) {
        if (!process.env.RRA_EBM_API_KEY?.trim()) {
            console.warn('⚠️  RRA_EBM_ENABLED=true but RRA_EBM_API_KEY is empty.');
        }
        if (!process.env.RRA_EBM_DEVICE_SERIAL?.trim() && !facility.ebm_device_serial?.trim()) {
            console.warn('⚠️  No device serial in env or facility — RRA_EBM_DEVICE_SERIAL or facility.ebm_device_serial should be set.');
        }
    }

    const baseUrl = process.env.SMOKE_API_BASE_URL?.replace(/\/$/, '');
    const jwt = process.env.SMOKE_JWT?.trim();
    if (baseUrl && jwt) {
        const prefix = process.env.API_PREFIX || '/api';
        const url = `${baseUrl}${prefix}/pharmacy/reports/fiscal-queue/${facilityId}`;
        try {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
            });
            if (!res.ok) {
                console.error(`❌ Fiscal queue HTTP ${res.status} ${res.statusText} — ${url}`);
                failed = true;
            } else {
                console.log(`✅ Fiscal queue API OK (${url})`);
            }
        } catch (e) {
            console.error('❌ Fiscal queue request failed:', e);
            failed = true;
        }
    } else if (baseUrl || jwt) {
        console.warn('⚠️  Set both SMOKE_API_BASE_URL and SMOKE_JWT for API smoke, or omit both.');
    }

    await AppDataSource.destroy();

    if (failed) {
        process.exit(1);
    }
    console.log('Pilot smoke checks passed.');
}

main().catch(async (err) => {
    console.error(err);
    try {
        if (AppDataSource.isInitialized) await AppDataSource.destroy();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
