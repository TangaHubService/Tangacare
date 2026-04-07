import { logger } from '../middleware/logger.middleware';

export class SmsUtil {
    /**
     * Sends an SMS message via a gateway.
     * For now, this is a mock implementation that logs to the console/system logger.
     */
    static async sendSms(to: string, message: string): Promise<boolean> {
        try {
            // Validation
            if (!to || !message) {
                logger.warn('SMS failed: Recipient or message missing');
                return false;
            }

            // In a real implementation:
            // const response = await axios.post('SMS_GATEWAY_URL', {
            //     to: to.startsWith('+') ? to : `+${to}`,
            //     text: message,
            //     apikey: process.env.SMS_API_KEY
            // });

            // Mock Implementation
            console.log('\n--- [MOCK SMS START] ---');
            console.log(`To: ${to}`);
            console.log(`Message: ${message}`);
            console.log('--- [MOCK SMS END] ---\n');

            logger.info(`[SMS SENT MOCK] To: ${to}, Message: "${message.substring(0, 50)}..."`);

            return true;
        } catch (error) {
            logger.error('Error sending SMS:', error);
            return false;
        }
    }

    /**
     * Specialized method for urgent recall SMS
     */
    static async sendRecallAlert(to: string, medicineName: string, batchNumber: string): Promise<boolean> {
        const message = `URGENT ALERT: A recall has been issued for ${medicineName} (Batch: ${batchNumber}). Please stop use immediately. Check your app for details. - TangaCare`;
        return this.sendSms(to, message);
    }
}
