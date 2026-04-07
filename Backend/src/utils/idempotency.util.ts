import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { IdempotencyKey, IdempotencyStatus } from '../entities/IdempotencyKey.entity';

type IdempotencyEntry = {
    expiresAt: number;
    statusCode: number;
    body: any;
};

export class IdempotencyStore {
    private static readonly TTL_MS = 15 * 60 * 1000;

    private static get repository(): Repository<IdempotencyKey> {
        return AppDataSource.getRepository(IdempotencyKey);
    }

    static buildKey(namespace: string, key: string, facilityId?: number, userId?: number): string {
        return `${namespace}:${facilityId || 'na'}:${userId || 'na'}:${key}`;
    }

    static async get(key: string): Promise<IdempotencyEntry | null> {
        await this.cleanup();

        const entry = await this.repository.findOne({
            where: { idempotency_key: key },
        });

        if (!entry) {
            return null;
        }

        if (entry.status !== IdempotencyStatus.COMPLETED || entry.status_code === null || entry.response_body === null) {
            return null;
        }

        return {
            expiresAt: entry.expires_at.getTime(),
            statusCode: entry.status_code,
            body: entry.response_body,
        };
    }

    static async set(key: string, statusCode: number, body: any): Promise<void> {
        await this.repository.update(
            { idempotency_key: key },
            {
                status: IdempotencyStatus.COMPLETED,
                status_code: statusCode,
                response_body: body,
            },
        );
    }

    static async markInFlight(
        key: string,
        namespace: string,
        facilityId?: number,
        userId?: number,
    ): Promise<boolean> {
        await this.cleanup();

        const record = this.repository.create({
            idempotency_key: key,
            namespace,
            facility_id: facilityId || null,
            user_id: userId || null,
            status: IdempotencyStatus.IN_PROGRESS,
            status_code: null,
            response_body: null,
            expires_at: new Date(Date.now() + this.TTL_MS),
        });

        try {
            await this.repository.insert(record);
            return true;
        } catch (error: any) {
            // 23505 = unique_violation in PostgreSQL
            if (error?.code !== '23505') {
                throw error;
            }
            return false;
        }
    }

    static async clearInFlight(key: string): Promise<void> {
        await this.repository.delete({
            idempotency_key: key,
            status: IdempotencyStatus.IN_PROGRESS,
        });
    }

    private static async cleanup(): Promise<void> {
        await this.repository
            .createQueryBuilder()
            .delete()
            .from(IdempotencyKey)
            .where('expires_at < NOW()')
            .execute();
    }
}
