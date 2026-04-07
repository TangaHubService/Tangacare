import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { ResponseUtil } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    register = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.authService.register(req.body);
            ResponseUtil.created(res, result, 'User registered successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Registration failed', error.message);
            }
        }
    };

    login = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.authService.login(req.body);
            ResponseUtil.success(res, result, 'Login successful');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Login failed', error.message);
            }
        }
    };

    refreshToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const { refreshToken } = req.body;
            const tokens = await this.authService.refreshToken(refreshToken);
            ResponseUtil.success(res, tokens, 'Token refreshed successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Token refresh failed', error.message);
            }
        }
    };

    getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const user = await this.authService.getProfile(req.user!.userId);
            ResponseUtil.success(res, user, 'Profile retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to get profile', error.message);
            }
        }
    };

    updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const user = await this.authService.updateProfile(req.user!.userId, req.body);
            ResponseUtil.success(res, user, 'Profile updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update profile', error.message);
            }
        }
    };

    deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await this.authService.softDeleteAccount(req.user!.userId);
            ResponseUtil.success(res, null, 'Account deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete account', error.message);
            }
        }
    };

    verifyOtp = async (req: Request, res: Response): Promise<void> => {
        try {
            const { identifier, otp, phone_number } = req.body;

            const id = identifier || phone_number;

            const result = await this.authService.verifyOtp(id, otp);
            ResponseUtil.success(res, result, 'OTP verified successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'OTP verification failed', error.message);
            }
        }
    };

    setInitialPassword = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.userId;
            const { newPassword } = req.body;
            const user = await this.authService.setInitialPassword(userId, newPassword);
            ResponseUtil.success(res, user, 'Password set successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to set password', error.message);
            }
        }
    };

    requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
        try {
            const { identifier } = req.body;
            const result = await this.authService.requestPasswordReset(identifier);
            ResponseUtil.success(res, result, result.message);
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Password reset request failed', error.message);
            }
        }
    };

    verifyResetOtp = async (req: Request, res: Response): Promise<void> => {
        try {
            const { identifier, otp } = req.body;
            const verified = await this.authService.verifyResetOtp(identifier, otp);
            ResponseUtil.success(res, { verified }, 'OTP verified successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'OTP verification failed', error.message);
            }
        }
    };

    resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const { identifier, otp, newPassword } = req.body;
            const result = await this.authService.resetPassword(identifier, otp, newPassword);
            ResponseUtil.success(res, result, result.message);
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Password reset failed', error.message);
            }
        }
    };
}
