/**
 * Promote (or create) the platform super admin by email and set password (bcrypt).
 *
 * Usage (from repo root):
 *   SUPER_ADMIN_PASSWORD='your-secure-password' yarn ensure-super-admin
 *
 * Optional:
 *   SUPER_ADMIN_EMAIL=tangahubservices@gmail.com
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import bcrypt from 'bcrypt';
import { AppDataSource } from '../src/config/database';
import { User, UserRole } from '../src/entities/User.entity';

const DEFAULT_EMAIL = 'tangahubservices@gmail.com';
const DEFAULT_PHONE = '+250788112233';

async function main(): Promise<void> {
    const email = (process.env.SUPER_ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!password || password.length < 8) {
        console.error('Missing or weak SUPER_ADMIN_PASSWORD. Set it in the environment (min 8 characters).');
        console.error('Example: SUPER_ADMIN_PASSWORD=\'…\' yarn ensure-super-admin');
        process.exit(1);
    }

    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository(User);

    const password_hash = await bcrypt.hash(password, 10);

    let user = await repo.findOne({ where: { email } });

    const phoneOwner = await repo.findOne({ where: { phone_number: DEFAULT_PHONE } });
    const canUseDefaultPhone = !phoneOwner || (user != null && phoneOwner.id === user.id);

    if (!user) {
        user = repo.create({
            phone_number: canUseDefaultPhone ? DEFAULT_PHONE : null,
            email,
            password_hash,
            first_name: 'Supreme',
            last_name: 'Administrator',
            role: UserRole.SUPER_ADMIN,
            is_verified: true,
            gender: 'male',
            date_of_birth: new Date('1980-01-01'),
            preferred_language: 'en',
            must_set_password: false,
        });
        await repo.save(user);
        console.log('✅ Created SUPER_ADMIN:', email);
    } else {
        user.role = UserRole.SUPER_ADMIN;
        user.password_hash = password_hash;
        user.is_verified = true;
        user.must_set_password = false;
        if (!user.first_name?.trim()) user.first_name = 'Supreme';
        if (!user.last_name?.trim()) user.last_name = 'Administrator';
        if (canUseDefaultPhone && !user.phone_number) {
            user.phone_number = DEFAULT_PHONE;
        }
        await repo.save(user);
        console.log('✅ Updated SUPER_ADMIN (role + password):', email);
    }

    await AppDataSource.destroy();
}

main().catch(async (err) => {
    console.error(err);
    try {
        if (AppDataSource.isInitialized) await AppDataSource.destroy();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
