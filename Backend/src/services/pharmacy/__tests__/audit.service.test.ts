import { AuditService } from '../audit.service';
import { AppDataSource } from '../../../config/database';
import { AuditAction, AuditEntityType } from '../../../entities/AuditLog.entity';

jest.mock('../../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('AuditService', () => {
    let auditService: AuditService;
    let mockRepository: any;

    beforeEach(() => {
        mockRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
        auditService = new AuditService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('log', () => {
        it('should create audit log successfully', async () => {
            const auditData = {
                facility_id: 1,
                user_id: 1,
                action: AuditAction.CREATE,
                entity_type: AuditEntityType.MEDICINE,
                entity_id: 1,
                entity_name: 'Paracetamol',
                description: 'Medicine created',
            };

            const savedAuditLog = { ...auditData, id: 1, created_at: new Date() };
            mockRepository.create.mockReturnValue(savedAuditLog);
            mockRepository.save.mockResolvedValue(savedAuditLog);

            const result = await auditService.log(auditData);

            expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining(auditData));
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(savedAuditLog);
        });
    });

    describe('findAll', () => {
        it('should return paginated audit logs', async () => {
            const auditLogs = [
                {
                    id: 1,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.MEDICINE,
                    created_at: new Date(),
                },
                {
                    id: 2,
                    action: AuditAction.UPDATE,
                    entity_type: AuditEntityType.STOCK,
                    created_at: new Date(),
                },
            ];
            const total = 2;

            const mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([auditLogs, total]),
            };

            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

            const result = await auditService.findAll(1, undefined, undefined, undefined, 1, 10);

            expect(result.data).toEqual(auditLogs);
            expect(result.total).toBe(total);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });
    });

    describe('findOne', () => {
        let mockQueryBuilder: any;

        beforeEach(() => {
            mockQueryBuilder = {
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getOne: jest.fn(),
            };
            mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
        });

        it('should return audit log if found', async () => {
            const auditLog = {
                id: 1,
                action: AuditAction.CREATE,
                entity_type: AuditEntityType.MEDICINE,
            };
            mockQueryBuilder.getOne.mockResolvedValue(auditLog);

            const result = await auditService.findOne(1);

            expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('audit');
            expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('audit.user', 'user');
            expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('audit.facility', 'facility');
            expect(mockQueryBuilder.where).toHaveBeenCalledWith('audit.id = :id', { id: 1 });
            expect(result).toEqual(auditLog);
        });

        it('should throw error if audit log not found', async () => {
            mockQueryBuilder.getOne.mockResolvedValue(null);

            await expect(auditService.findOne(999)).rejects.toThrow('Audit log not found');
        });
    });
});
