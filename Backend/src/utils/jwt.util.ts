import jwt from 'jsonwebtoken';
import { UserRole } from '../entities/User.entity';

export interface JwtPayload {
    userId: number;
    email: string;
    role: UserRole;
    organizationId?: number;
    facilityId?: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export class JwtUtil {
    static generateAccessToken(payload: JwtPayload): string {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN as any,
        });
    }

    static generateRefreshToken(payload: JwtPayload): string {
        return jwt.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: JWT_REFRESH_EXPIRES_IN as any,
        });
    }

    static generateTokenPair(payload: JwtPayload): TokenPair {
        return {
            accessToken: this.generateAccessToken(payload),
            refreshToken: this.generateRefreshToken(payload),
        };
    }

    static verifyAccessToken(token: string): JwtPayload {
        try {
            return jwt.verify(token, JWT_SECRET) as JwtPayload;
        } catch (error) {
            throw new Error('Invalid or expired access token');
        }
    }

    static verifyRefreshToken(token: string): JwtPayload {
        try {
            return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    static decodeToken(token: string): JwtPayload | null {
        try {
            return jwt.decode(token) as JwtPayload;
        } catch (error) {
            return null;
        }
    }
}
