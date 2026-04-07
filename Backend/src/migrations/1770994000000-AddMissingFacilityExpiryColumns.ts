import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMissingFacilityExpiryColumns1770994000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('facilities', [
            new TableColumn({
                name: 'expiry_critical_days',
                type: 'int',
                default: 30,
            }),
            new TableColumn({
                name: 'expiry_warning_days',
                type: 'int',
                default: 60,
            }),
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('facilities', 'expiry_critical_days');
        await queryRunner.dropColumn('facilities', 'expiry_warning_days');
    }
}
