import api from '../lib/api';
import type { AuthResponse, LoginCredentials, RegisterCredentials, User } from '../types/auth';

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/auth/login', {
            identifier: credentials.email,
            password: credentials.password,
        });
        if (response.data.data.tokens) {
            localStorage.setItem('access_token', response.data.data.tokens.accessToken);
            localStorage.setItem('refresh_token', response.data.data.tokens.refreshToken);
        }
        const user = response.data.data.user;
        if (user) {
            localStorage.setItem('user_data', JSON.stringify(user));
        }

        return response.data;
    },

    async register(credentials: RegisterCredentials): Promise<AuthResponse> {
        const response = await api.post<AuthResponse>('/auth/register', credentials);
        return response.data;
    },

    async logout(): Promise<void> {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('selected_organization_id');
        localStorage.removeItem('selected_facility_id');
    },

    async getProfile(): Promise<User> {
        const response = await api.get<{ data: User }>('/auth/me');
        return response.data.data;
    },

    async refreshToken(): Promise<void> {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) return;
        const response = await api.post<{ data: { accessToken: string; refreshToken?: string } }>(
            '/auth/refresh-token',
            { refreshToken },
        );
        const tokens = response.data?.data;
        if (tokens?.accessToken) {
            localStorage.setItem('access_token', tokens.accessToken);
            if (tokens.refreshToken) localStorage.setItem('refresh_token', tokens.refreshToken);
        }
    },

    async forgotPassword(email: string): Promise<any> {
        const response = await api.post('/auth/forgot-password', { identifier: email });
        return response.data;
    },

    async verifyResetOtp(identifier: string, otp: string): Promise<any> {
        const response = await api.post('/auth/verify-reset-otp', { identifier, otp });
        return response.data;
    },

    async verifyRegistrationOtp(email: string, otp: string): Promise<any> {
        const response = await api.post('/auth/verify-otp', { identifier: email, otp });
        return response.data;
    },

    async resetPassword(data: {
        identifier: string;
        otp: string;
        newPassword: string;
    }): Promise<any> {
        const response = await api.post('/auth/reset-password', data);
        return response.data;
    },

    async setInitialPassword(newPassword: string): Promise<any> {
        const response = await api.post('/auth/set-initial-password', { newPassword });
        return response.data;
    },
};
