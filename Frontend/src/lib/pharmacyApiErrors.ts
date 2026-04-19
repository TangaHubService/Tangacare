/**
 * Maps pharmacy / POS API failures to operator-friendly copy.
 */
export function formatPharmacyApiError(error: unknown): string {
    const e = error as {
        response?: { status?: number; data?: { message?: string; error?: string } };
        message?: string;
    };
    const status = e?.response?.status;
    const bodyMsg = e?.response?.data?.message || e?.response?.data?.error;
    const raw = (typeof bodyMsg === 'string' && bodyMsg.trim() ? bodyMsg : e?.message) || '';

    if (status === 403) {
        if (raw.trim()) return raw.trim();
        return 'You do not have permission to complete this sale. Ask a supervisor to grant dispensing access, or use an account with checkout rights.';
    }

    if (status === 401) {
        return 'Your session expired. Sign in again, then retry checkout.';
    }

    if (status === 409) {
        if (raw.trim()) return raw.trim();
        return 'This action conflicts with current stock rules (for example FEFO or a frozen batch). Review the message above the cart or pick the suggested batch.';
    }

    if (raw.trim()) return raw.trim();
    return 'Something went wrong during checkout. Please try again or contact support if it continues.';
}
