import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';

async function testEmail() {
    console.log('Testing Email Sending...');
    console.log(`SMTP_HOST: ${process.env.SMTP_HOST}`);
    console.log(`SMTP_PORT: ${process.env.SMTP_PORT}`);
    const pass = (process.env.SMTP_PASS || '').replace(/^"(.*)"$/, '$1');
    console.log(`SMTP_PASS length: ${pass.length}`);

    try {
        // Create a local transporter to be sure about the settings
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: pass,
            },
            debug: true,
            logger: true,
        });

        console.log('Sending email...');
        const result = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Tangacare" <noreply@tangacare.com>',
            to: 'nniyonkurubbertin@gmail.com',
            subject: 'Test Email from Tangacare Debug Script',
            html: '<h1>This is a test email</h1><p>If you see this, SMTP is working.</p>'
        });

        if (result) {
            console.log('✅ Email sent successfully!');
        } else {
            console.error('❌ Email sending failed (returned false).');
        }
    } catch (error) {
        console.error('❌ Error sending email:', error);
    }
}

testEmail();
