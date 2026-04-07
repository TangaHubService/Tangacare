import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateDto } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    VerifyOtpDto,
    UpdateUserDto,
    SetInitialPasswordDto,
    RequestPasswordResetDto,
    VerifyResetOtpDto,
    ResetPasswordDto,
} from '../dto/auth.dto';

const router = Router();
const authController = new AuthController();

router.post('/register', validateDto(RegisterDto), authController.register);

router.post('/login', validateDto(LoginDto), authController.login);

router.post('/refresh-token', validateDto(RefreshTokenDto), authController.refreshToken);

router.post('/verify-otp', validateDto(VerifyOtpDto), authController.verifyOtp);

router.get('/me', authenticate, authController.getProfile);

router.patch('/me', authenticate, validateDto(UpdateUserDto), authController.updateProfile);

router.post(
    '/set-initial-password',
    authenticate,
    validateDto(SetInitialPasswordDto),
    authController.setInitialPassword,
);

router.post('/forgot-password', validateDto(RequestPasswordResetDto), authController.requestPasswordReset);

router.post('/verify-reset-otp', validateDto(VerifyResetOtpDto), authController.verifyResetOtp);

router.post('/reset-password', validateDto(ResetPasswordDto), authController.resetPassword);

router.delete('/me', authenticate, authController.deleteAccount);

export default router;
