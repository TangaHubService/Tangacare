import { AuthService } from '../../services/auth.service';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { RegisterDto, LoginDto, UpdateUserDto } from '../../dto/auth.dto';
import bcrypt from 'bcrypt';

jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

jest.mock('bcrypt');

describe('AuthService', () => {
    let authService: AuthService;
    let mockRepository: any;

    beforeEach(() => {
        mockRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
        authService = new AuthService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        const registerDto: RegisterDto = {
            phone_number: '+250788123456',
            email: 'test@example.com',
            password: 'SecurePass123',
            first_name: 'John',
            last_name: 'Doe',
            date_of_birth: '1990-01-15',
            gender: 'male',
            preferred_language: 'en',
        };

        it('should register a new user successfully', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
            const savedUser = { ...registerDto, id: 1, password_hash: 'hashedPassword' };
            mockRepository.create.mockReturnValue(savedUser);
            mockRepository.save.mockResolvedValue(savedUser);

            const result = await authService.register(registerDto);

            expect(mockRepository.findOne).toHaveBeenCalled();
            expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result.message).toBeDefined();
            expect(result.userId).toBeDefined();
        });

        it('should throw error if user already exists', async () => {
            const existingUser = { id: 1, phone_number: '+250788123456' };
            mockRepository.findOne.mockResolvedValue(existingUser);

            await expect(authService.register(registerDto)).rejects.toThrow(AppError);
            await expect(authService.register(registerDto)).rejects.toThrow(
                'User with this phone number or email already exists',
            );
        });
    });

    describe('login', () => {
        const loginDto: LoginDto = {
            identifier: '+250788123456',
            password: 'SecurePass123',
        };

        it('should login user successfully', async () => {
            const user = {
                id: 1,
                phone_number: '+250788123456',
                password_hash: 'hashedPassword',
                is_active: true,
                is_verified: true,
                deleted_at: null,
            };
            mockRepository.findOne.mockResolvedValue(user);
            (bcrypt.compare as jest.Mock).mockResolvedValue(true);

            const result = await authService.login(loginDto);

            expect(mockRepository.findOne).toHaveBeenCalled();
            expect(bcrypt.compare).toHaveBeenCalledWith(loginDto.password, 'hashedPassword');
            expect(result.user).toBeDefined();
            expect(result.tokens).toBeDefined();
        });

        it('should throw error if user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(authService.login(loginDto)).rejects.toThrow(AppError);
            await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
        });

        it('should throw error if account is deactivated', async () => {
            const user = {
                id: 1,
                phone_number: '+250788123456',
                password_hash: 'hashedPassword',
                is_active: false,
                deleted_at: new Date(),
            };
            mockRepository.findOne.mockResolvedValue(user);

            await expect(authService.login(loginDto)).rejects.toThrow(AppError);
            await expect(authService.login(loginDto)).rejects.toThrow('Account has been deactivated');
        });

        it('should throw error if password is invalid', async () => {
            const user = {
                id: 1,
                phone_number: '+250788123456',
                password_hash: 'hashedPassword',
                is_active: true,
                deleted_at: null,
            };
            mockRepository.findOne.mockResolvedValue(user);
            (bcrypt.compare as jest.Mock).mockResolvedValue(false);

            await expect(authService.login(loginDto)).rejects.toThrow(AppError);
            await expect(authService.login(loginDto)).rejects.toThrow('Invalid credentials');
        });
    });

    describe('softDeleteAccount', () => {
        it('should soft delete user account', async () => {
            const user = {
                id: 1,
                is_active: true,
                deleted_at: null,
            };
            mockRepository.findOne.mockResolvedValue(user);
            mockRepository.save.mockResolvedValue({
                ...user,
                is_active: false,
                deleted_at: expect.any(Date),
            });

            await authService.softDeleteAccount(1);

            expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(mockRepository.save).toHaveBeenCalled();
        });

        it('should throw error if user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(authService.softDeleteAccount(999)).rejects.toThrow(AppError);
            await expect(authService.softDeleteAccount(999)).rejects.toThrow('User not found');
        });
    });

    describe('updateProfile', () => {
        const updateDto: UpdateUserDto = {
            first_name: 'Jane',
            last_name: 'Smith',
        };

        it('should update user profile successfully', async () => {
            const user = {
                id: 1,
                first_name: 'John',
                last_name: 'Doe',
            };
            mockRepository.findOne.mockResolvedValue(user);
            mockRepository.save.mockResolvedValue({ ...user, ...updateDto });

            const result = await authService.updateProfile(1, updateDto);

            expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result.first_name).toBe(updateDto.first_name);
            expect(result.last_name).toBe(updateDto.last_name);
        });

        it('should throw error if user not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(authService.updateProfile(999, updateDto)).rejects.toThrow(AppError);
            await expect(authService.updateProfile(999, updateDto)).rejects.toThrow('User not found');
        });
    });
});
