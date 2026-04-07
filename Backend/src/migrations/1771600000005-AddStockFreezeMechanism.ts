import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStockFreezeMechanism1771600000005 implements MigrationInterface {
    name = 'AddStockFreezeMechanism1771600000005';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'frozen' to physical_counts_status_enum
        // Using ALTER TYPE ADD VALUE which cannot be executed within a transaction in some Postgres versions
        // but TypeORM usually handles this if we use queryRunner.query
        await queryRunner.query(`ALTER TYPE "public"."physical_counts_status_enum" ADD VALUE IF NOT EXISTS 'frozen' BEFORE 'completed'`);

        // Add is_frozen column to stocks table
        await queryRunner.query(`ALTER TABLE "stocks" ADD "is_frozen" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove is_frozen column
        await queryRunner.query(`ALTER TABLE "stocks" DROP COLUMN "is_frozen"`);

        // Removing a value from an ENUM is complex in Postgres (usually requires recreating the type)
        // Given this is a pharmacy system, we'll keep the value in the enum to avoid data loss risk 
        // but we could implement the full recreation if strictly necessary.
        // For now, we'll leave it as a safe "no-op" for the enum down migration.
    }
}
