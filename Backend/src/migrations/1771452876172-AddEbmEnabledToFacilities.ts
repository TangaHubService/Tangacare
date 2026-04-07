import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEbmEnabledToFacilities1771452876172 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'facilities',
            new TableColumn({
                name: 'ebm_enabled',
                type: 'boolean',
                default: false,
                isNullable: false,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('facilities', 'ebm_enabled');
    }
}
