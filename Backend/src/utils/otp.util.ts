export function generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getOtpExpiry(minutes?: number): Date {
    const expiryMinutes = minutes || parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + expiryMinutes);
    return expiry;
}

export function isOtpExpired(expiryDate: Date): boolean {
    return new Date() > expiryDate;
}
