import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddPrescriptionIdToSale1771000000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'sales',
            new TableColumn({
                name: 'prescription_id',
                type: 'int',
                isNullable: true,
            }),
        );

        await queryRunner.createForeignKey(
            'sales',
            new TableForeignKey({
                columnNames: ['prescription_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'prescriptions',
                onDelete: 'SET NULL',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('sales');
        if (table) {
            const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf('prescription_id') !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey('sales', foreignKey);
            }
        }
        await queryRunner.dropColumn('sales', 'prescription_id');
    }
}
