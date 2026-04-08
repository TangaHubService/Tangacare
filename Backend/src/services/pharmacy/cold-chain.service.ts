import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { StorageLocation, TemperatureType } from '../../entities/StorageLocation.entity';
import { ColdChainTelemetry, ColdChainTelemetrySource } from '../../entities/ColdChainTelemetry.entity';
import { ColdChainExcursion, ColdChainExcursionStatus } from '../../entities/ColdChainExcursion.entity';
import { AlertType } from '../../entities/Alert.entity';
import { AlertService } from './alert.service';
import { InventoryNotificationService } from './inventory-notification.service';

export interface LogTelemetryInput {
    temperature_c: number;
    humidity_percent?: number;
    source?: ColdChainTelemetrySource;
    notes?: string;
    recorded_at?: string;
}

interface TemperatureRange {
    min: number;
    max: number;
    label: string;
}

export class ColdChainService {
    private locationRepository: Repository<StorageLocation>;
    private telemetryRepository: Repository<ColdChainTelemetry>;
    private excursionRepository: Repository<ColdChainExcursion>;
    private alertService: AlertService;
    private inventoryNotificationService: InventoryNotificationService;

    constructor() {
        this.locationRepository = AppDataSource.getRepository(StorageLocation);
        this.telemetryRepository = AppDataSource.getRepository(ColdChainTelemetry);
        this.excursionRepository = AppDataSource.getRepository(ColdChainExcursion);
        this.alertService = new AlertService();
        this.inventoryNotificationService = new InventoryNotificationService();
    }

    private getTemperatureRange(type: TemperatureType): TemperatureRange {
        switch (type) {
            case TemperatureType.COLD:
                return { min: 2, max: 8, label: '2°C to 8°C' };
            case TemperatureType.FROZEN:
                return { min: -30, max: -15, label: '-30°C to -15°C' };
            default:
                return { min: 15, max: 25, label: '15°C to 25°C' };
        }
    }

    private async getScopedLocation(facilityId: number, locationId: number): Promise<StorageLocation> {
        const location = await this.locationRepository.findOne({
            where: {
                id: locationId,
                facility_id: facilityId,
                is_active: true,
            },
        });

        if (!location) {
            throw new AppError('Storage location not found in current facility scope', 404);
        }

        return location;
    }

    private toNumber(value: any): number {
        if (typeof value === 'number') {
            return value;
        }
        return Number(value || 0);
    }

    private shouldNotify(lastNotifiedAt?: Date | null): boolean {
        if (!lastNotifiedAt) {
            return true;
        }

        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return new Date(lastNotifiedAt) < oneDayAgo;
    }

    private formatTelemetry(log: ColdChainTelemetry) {
        return {
            id: log.id,
            facility_id: log.facility_id,
            storage_location_id: log.storage_location_id,
            recorded_by_id: log.recorded_by_id,
            source: log.source,
            temperature_c: this.toNumber(log.temperature_c),
            humidity_percent: log.humidity_percent === null ? null : this.toNumber(log.humidity_percent),
            expected_min_c: this.toNumber(log.expected_min_c),
            expected_max_c: this.toNumber(log.expected_max_c),
            within_range: log.within_range,
            notes: log.notes,
            recorded_at: log.recorded_at,
            created_at: log.created_at,
        };
    }

    private formatExcursion(excursion: ColdChainExcursion) {
        return {
            id: excursion.id,
            facility_id: excursion.facility_id,
            storage_location_id: excursion.storage_location_id,
            status: excursion.status,
            started_at: excursion.started_at,
            last_observed_at: excursion.last_observed_at,
            recovered_at: excursion.recovered_at,
            resolved_at: excursion.resolved_at,
            opened_by_id: excursion.opened_by_id,
            acknowledged_by_id: excursion.acknowledged_by_id,
            resolved_by_id: excursion.resolved_by_id,
            highest_temperature_c: this.toNumber(excursion.highest_temperature_c),
            lowest_temperature_c: this.toNumber(excursion.lowest_temperature_c),
            last_temperature_c: this.toNumber(excursion.last_temperature_c),
            expected_min_c: this.toNumber(excursion.expected_min_c),
            expected_max_c: this.toNumber(excursion.expected_max_c),
            resolution_action: excursion.resolution_action,
            resolution_notes: excursion.resolution_notes,
            created_at: excursion.created_at,
            updated_at: excursion.updated_at,
            location: (excursion as any).location
                ? {
                      id: (excursion as any).location.id,
                      name: (excursion as any).location.name,
                      code: (excursion as any).location.code,
                      temperature_type: (excursion as any).location.temperature_type,
                  }
                : undefined,
        };
    }

    async logTelemetry(facilityId: number, locationId: number, input: LogTelemetryInput, userId?: number) {
        const location = await this.getScopedLocation(facilityId, locationId);
        const range = this.getTemperatureRange(location.temperature_type);

        const recordedAt = input.recorded_at ? new Date(input.recorded_at) : new Date();
        if (Number.isNaN(recordedAt.getTime())) {
            throw new AppError('Invalid recorded_at timestamp', 400);
        }

        const withinRange = input.temperature_c >= range.min && input.temperature_c <= range.max;

        const telemetry = this.telemetryRepository.create({
            facility_id: facilityId,
            storage_location_id: location.id,
            recorded_by_id: userId || null,
            source: input.source || ColdChainTelemetrySource.MANUAL,
            temperature_c: input.temperature_c,
            humidity_percent: input.humidity_percent ?? null,
            expected_min_c: range.min,
            expected_max_c: range.max,
            within_range: withinRange,
            notes: input.notes || null,
            recorded_at: recordedAt,
        });

        const savedLog = await this.telemetryRepository.save(telemetry);

        let excursion = await this.excursionRepository.findOne({
            where: {
                facility_id: facilityId,
                storage_location_id: location.id,
                status: In([ColdChainExcursionStatus.OPEN, ColdChainExcursionStatus.ACKNOWLEDGED]),
            },
            order: {
                started_at: 'DESC',
            },
            relations: ['location'],
        });
        const hadOpenExcursion = Boolean(excursion);

        if (!withinRange) {
            if (!excursion) {
                excursion = this.excursionRepository.create({
                    facility_id: facilityId,
                    organization_id: location.organization_id ?? null,
                    storage_location_id: location.id,
                    status: ColdChainExcursionStatus.OPEN,
                    started_at: recordedAt,
                    last_observed_at: recordedAt,
                    recovered_at: null,
                    resolved_at: null,
                    opened_by_id: userId || null,
                    highest_temperature_c: input.temperature_c,
                    lowest_temperature_c: input.temperature_c,
                    last_temperature_c: input.temperature_c,
                    expected_min_c: range.min,
                    expected_max_c: range.max,
                });
            } else {
                excursion.last_observed_at = recordedAt;
                excursion.last_temperature_c = input.temperature_c;
                excursion.organization_id = excursion.organization_id ?? location.organization_id ?? null;
                excursion.highest_temperature_c = Math.max(
                    this.toNumber(excursion.highest_temperature_c),
                    input.temperature_c,
                );
                excursion.lowest_temperature_c = Math.min(
                    this.toNumber(excursion.lowest_temperature_c),
                    input.temperature_c,
                );
                excursion.expected_min_c = range.min;
                excursion.expected_max_c = range.max;
                excursion.recovered_at = null;
            }
            excursion = await this.excursionRepository.save(excursion);
            excursion = await this.excursionRepository.findOne({
                where: { id: excursion.id },
                relations: ['location'],
            });
        } else if (excursion) {
            excursion.last_observed_at = recordedAt;
            excursion.last_temperature_c = input.temperature_c;
            if (!excursion.recovered_at) {
                excursion.recovered_at = recordedAt;
            }
            excursion = await this.excursionRepository.save(excursion);
            excursion = await this.excursionRepository.findOne({
                where: { id: excursion.id },
                relations: ['location'],
            });
        }

        if (excursion) {
            const organizationId = Number(excursion.organization_id || location.organization_id || 0);
            if (organizationId > 0) {
                try {
                    const alert = await this.alertService.upsertOperationalAlert({
                        facilityId,
                        organizationId,
                        type: AlertType.COLD_CHAIN_EXCURSION,
                        referenceType: 'cold_chain_excursion',
                        referenceId: excursion.id,
                        title: withinRange
                            ? `Cold Chain Recovery Pending Review: ${location.name}`
                            : `Cold Chain Excursion: ${location.name}`,
                        message: withinRange
                            ? `${location.name} returned to the expected temperature range, but the excursion still requires review and disposition.`
                            : `${location.name} recorded ${input.temperature_c}C outside the allowed range (${range.label}).`,
                        severity: withinRange ? 'warning' : 'critical',
                        currentValue: Math.round(input.temperature_c),
                        thresholdValue: Math.round(range.max),
                        contextData: {
                            excursion_status: excursion.status,
                            location_name: location.name,
                            location_code: location.code,
                            observed_temperature_c: input.temperature_c,
                            expected_min_c: range.min,
                            expected_max_c: range.max,
                            recovered_at: excursion.recovered_at,
                            last_observed_at: excursion.last_observed_at,
                        },
                    });

                    if (!withinRange && (!hadOpenExcursion || this.shouldNotify(alert.last_notified_at))) {
                        await this.inventoryNotificationService.notifyColdChainExcursion(
                            facilityId,
                            location.name,
                            input.temperature_c,
                            range.min,
                            range.max,
                            alert.id,
                        );
                        await this.alertService.markAlertNotified(alert.id, {
                            source: 'cold_chain_notification',
                            excursionId: excursion.id,
                        });
                    }
                } catch (error) {
                    console.error('Failed to update cold-chain alert:', error);
                }
            }
        }

        return {
            telemetry: this.formatTelemetry(savedLog),
            excursion: excursion ? this.formatExcursion(excursion) : null,
            within_range: withinRange,
            expected_range: range,
            location: {
                id: location.id,
                name: location.name,
                code: location.code,
                temperature_type: location.temperature_type,
            },
        };
    }

    async getTelemetryHistory(facilityId: number, locationId: number, limit: number = 100) {
        await this.getScopedLocation(facilityId, locationId);

        const take = Math.max(1, Math.min(limit, 500));
        const telemetry = await this.telemetryRepository.find({
            where: {
                facility_id: facilityId,
                storage_location_id: locationId,
            },
            order: {
                recorded_at: 'DESC',
            },
            take,
        });

        return telemetry.map((entry) => this.formatTelemetry(entry));
    }

    async getExcursions(
        facilityId: number,
        status?: ColdChainExcursionStatus,
        locationId?: number,
        take: number = 50,
    ) {
        const qb = this.excursionRepository
            .createQueryBuilder('excursion')
            .leftJoinAndSelect('excursion.location', 'location')
            .where('excursion.facility_id = :facilityId', { facilityId })
            .orderBy('excursion.started_at', 'DESC')
            .take(Math.max(1, Math.min(take, 200)));

        if (status) {
            qb.andWhere('excursion.status = :status', { status });
        }

        if (locationId) {
            qb.andWhere('excursion.storage_location_id = :locationId', { locationId });
        }

        const excursions = await qb.getMany();
        return excursions.map((entry) => this.formatExcursion(entry));
    }

    async acknowledgeExcursion(facilityId: number, excursionId: number, userId?: number, notes?: string) {
        const excursion = await this.excursionRepository.findOne({
            where: { id: excursionId, facility_id: facilityId },
            relations: ['location'],
        });

        if (!excursion) {
            throw new AppError('Cold-chain excursion not found', 404);
        }

        if (excursion.status === ColdChainExcursionStatus.RESOLVED) {
            throw new AppError('Excursion is already resolved', 400);
        }

        excursion.status = ColdChainExcursionStatus.ACKNOWLEDGED;
        excursion.acknowledged_by_id = userId || null;

        if (notes) {
            const prefix = excursion.resolution_notes ? `${excursion.resolution_notes}\n` : '';
            excursion.resolution_notes = `${prefix}[ACK] ${notes}`;
        }

        const saved = await this.excursionRepository.save(excursion);
        const organizationId = Number(saved.organization_id || excursion.location?.organization_id || 0);
        if (organizationId > 0) {
            try {
                await this.alertService.acknowledgeAlertByReference({
                    facilityId,
                    organizationId,
                    type: AlertType.COLD_CHAIN_EXCURSION,
                    referenceType: 'cold_chain_excursion',
                    referenceId: saved.id,
                    userId: userId || null,
                    note: notes || 'Cold-chain excursion acknowledged',
                });
            } catch (error) {
                console.error('Failed to acknowledge cold-chain alert:', error);
            }
        }
        return this.formatExcursion(saved);
    }

    async resolveExcursion(
        facilityId: number,
        excursionId: number,
        actionTaken: string,
        userId?: number,
        notes?: string,
    ) {
        const excursion = await this.excursionRepository.findOne({
            where: { id: excursionId, facility_id: facilityId },
            relations: ['location'],
        });

        if (!excursion) {
            throw new AppError('Cold-chain excursion not found', 404);
        }

        if (excursion.status === ColdChainExcursionStatus.RESOLVED) {
            throw new AppError('Excursion is already resolved', 400);
        }

        const now = new Date();
        excursion.status = ColdChainExcursionStatus.RESOLVED;
        excursion.resolved_at = now;
        excursion.resolved_by_id = userId || null;
        excursion.resolution_action = actionTaken;

        if (!excursion.recovered_at) {
            excursion.recovered_at = now;
        }

        if (notes) {
            const prefix = excursion.resolution_notes ? `${excursion.resolution_notes}\n` : '';
            excursion.resolution_notes = `${prefix}[RESOLVE] ${notes}`;
        }

        const saved = await this.excursionRepository.save(excursion);
        const organizationId = Number(saved.organization_id || excursion.location?.organization_id || 0);
        if (organizationId > 0) {
            try {
                await this.alertService.resolveAlertByReference({
                    facilityId,
                    organizationId,
                    type: AlertType.COLD_CHAIN_EXCURSION,
                    referenceType: 'cold_chain_excursion',
                    referenceId: saved.id,
                    resolvedById: userId || null,
                    actionTaken,
                    actionReason:
                        notes ||
                        'Cold-chain excursion investigated and formally resolved with the recorded disposition.',
                    note: 'Cold-chain excursion resolved',
                });
            } catch (error) {
                console.error('Failed to resolve cold-chain alert:', error);
            }
        }
        return this.formatExcursion(saved);
    }

    async getOverview(facilityId: number) {
        const monitoredLocations = await this.locationRepository.count({
            where: {
                facility_id: facilityId,
                is_active: true,
                temperature_type: In([TemperatureType.COLD, TemperatureType.FROZEN]),
            },
        });

        const activeExcursions = await this.excursionRepository.find({
            where: {
                facility_id: facilityId,
                status: In([ColdChainExcursionStatus.OPEN, ColdChainExcursionStatus.ACKNOWLEDGED]),
            },
            relations: ['location'],
            order: { started_at: 'DESC' },
            take: 10,
        });

        const recoveredPendingResolution = await this.excursionRepository.count({
            where: {
                facility_id: facilityId,
                status: In([ColdChainExcursionStatus.OPEN, ColdChainExcursionStatus.ACKNOWLEDGED]),
                recovered_at: MoreThanOrEqual(new Date(0)),
            },
        });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const excursionsLast7Days = await this.excursionRepository.count({
            where: {
                facility_id: facilityId,
                started_at: MoreThanOrEqual(sevenDaysAgo),
            },
        });

        const since24h = new Date();
        since24h.setHours(since24h.getHours() - 24);

        const recentTelemetry = await this.telemetryRepository.find({
            where: {
                facility_id: facilityId,
                recorded_at: MoreThanOrEqual(since24h),
            },
            order: {
                recorded_at: 'ASC',
            },
            relations: ['location'],
        });

        const filteredTelemetry = recentTelemetry.filter(
            (row) =>
                row.location?.temperature_type === TemperatureType.COLD ||
                row.location?.temperature_type === TemperatureType.FROZEN,
        );

        const withinCount = filteredTelemetry.filter((row) => row.within_range).length;
        const complianceRate =
            filteredTelemetry.length > 0 ? Number(((withinCount / filteredTelemetry.length) * 100).toFixed(1)) : 100;

        const hourlyBuckets = new Map<
            string,
            {
                sum: number;
                count: number;
                excursions: number;
            }
        >();

        filteredTelemetry.forEach((row) => {
            const hour = new Date(row.recorded_at);
            hour.setMinutes(0, 0, 0);
            const key = hour.toISOString();
            const current = hourlyBuckets.get(key) || { sum: 0, count: 0, excursions: 0 };
            current.sum += this.toNumber(row.temperature_c);
            current.count += 1;
            if (!row.within_range) {
                current.excursions += 1;
            }
            hourlyBuckets.set(key, current);
        });

        const temperatureTrend = Array.from(hourlyBuckets.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([timestamp, bucket]) => ({
                timestamp,
                average_temperature_c: Number((bucket.sum / Math.max(bucket.count, 1)).toFixed(2)),
                readings: bucket.count,
                excursion_readings: bucket.excursions,
            }));

        const monitoredLocationList = await this.locationRepository.find({
            where: {
                facility_id: facilityId,
                is_active: true,
                temperature_type: In([TemperatureType.COLD, TemperatureType.FROZEN]),
            },
            order: {
                name: 'ASC',
            },
        });

        const latestTelemetryRaw: Array<{
            storage_location_id: number;
            temperature_c: string;
            within_range: boolean;
            recorded_at: string;
        }> = await this.telemetryRepository.query(
            `
                SELECT DISTINCT ON (storage_location_id)
                    storage_location_id,
                    temperature_c,
                    within_range,
                    recorded_at
                FROM cold_chain_telemetry
                WHERE facility_id = $1
                ORDER BY storage_location_id, recorded_at DESC
            `,
            [facilityId],
        );

        const latestByLocation = new Map<number, (typeof latestTelemetryRaw)[number]>();
        latestTelemetryRaw.forEach((row) => {
            latestByLocation.set(Number(row.storage_location_id), row);
        });

        const activeByLocation = new Map<number, (typeof activeExcursions)[number]>();
        activeExcursions.forEach((excursion) => {
            activeByLocation.set(excursion.storage_location_id, excursion);
        });

        const locationStatus = monitoredLocationList.map((location) => {
            const range = this.getTemperatureRange(location.temperature_type);
            const latest = latestByLocation.get(location.id);
            const activeExcursion = activeByLocation.get(location.id);
            const hasRecentData = Boolean(latest);

            return {
                location_id: location.id,
                location_name: location.name,
                location_code: location.code,
                temperature_type: location.temperature_type,
                expected_min_c: range.min,
                expected_max_c: range.max,
                expected_label: range.label,
                current_temperature_c: latest ? Number(latest.temperature_c) : null,
                last_logged_at: latest ? latest.recorded_at : null,
                within_range: latest ? Boolean(latest.within_range) : null,
                status: activeExcursion
                    ? 'critical'
                    : !hasRecentData
                      ? 'unknown'
                      : latest?.within_range
                        ? 'stable'
                        : 'warning',
                active_excursion_id: activeExcursion?.id || null,
            };
        });

        return {
            generated_at: new Date().toISOString(),
            monitored_locations: monitoredLocations,
            active_excursions: activeExcursions.length,
            recovered_pending_resolution: recoveredPendingResolution,
            excursions_last_7_days: excursionsLast7Days,
            compliance_rate_24h: complianceRate,
            temperature_trend: temperatureTrend,
            location_status: locationStatus,
            active_excursions_list: activeExcursions.map((entry) => this.formatExcursion(entry)),
        };
    }
}
