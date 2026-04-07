import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { AppDataSource, initializeDatabase } from '../config/database';
import { User, UserRole } from '../entities/User.entity';
import { Doctor } from '../entities/Doctor.entity';
import { Organization, OrganizationType } from '../entities/Organization.entity';
import { Facility, FacilityType } from '../entities/Facility.entity';
import { Medicine, DosageForm } from '../entities/Medicine.entity';
import { Supplier } from '../entities/Supplier.entity';
import { Batch } from '../entities/Batch.entity';
import { Stock } from '../entities/Stock.entity';
import { AuditLog, AuditAction, AuditEntityType } from '../entities/AuditLog.entity';
import { Appointment, AppointmentStatus } from '../entities/Appointment.entity';
import { StockMovement, StockMovementType } from '../entities/StockMovement.entity';
import { PurchaseOrder, PurchaseOrderStatus } from '../entities/PurchaseOrder.entity';
import { Sale, SaleStatus } from '../entities/Sale.entity';

dotenv.config();

const seed = async () => {
    try {
        await initializeDatabase();

        console.log('🔄 Synchronizing database schema...');
        await AppDataSource.synchronize();

        console.log('🌱 Starting comprehensive database seed...');

        const userRepository = AppDataSource.getRepository(User);
        const doctorRepository = AppDataSource.getRepository(Doctor);
        const organizationRepository = AppDataSource.getRepository(Organization);
        const facilityRepository = AppDataSource.getRepository(Facility);
        const medicineRepository = AppDataSource.getRepository(Medicine);
        const supplierRepository = AppDataSource.getRepository(Supplier);
        const batchRepository = AppDataSource.getRepository(Batch);
        const stockRepository = AppDataSource.getRepository(Stock);
        const auditLogRepository = AppDataSource.getRepository(AuditLog);
        const appointmentRepository = AppDataSource.getRepository(Appointment);
        const stockMovementRepository = AppDataSource.getRepository(StockMovement);
        const purchaseOrderRepository = AppDataSource.getRepository(PurchaseOrder);
        const saleRepository = AppDataSource.getRepository(Sale);

        const basePassword = 'Tangahub@2025';
        const password_hash = await bcrypt.hash(basePassword, 10);

        // ============================================
        // 1. CREATE ORGANIZATIONS
        // ============================================
        console.log('\n📍 Creating Organizations...');
        const organizationDatas = [
            { name: 'TangaCare Kenya Ltd', code: 'TCK', type: OrganizationType.PHARMACY_CHAIN },
            { name: 'TangaCare Rwanda Ltd', code: 'TCR', type: OrganizationType.SINGLE_PHARMACY },
            { name: 'HealthFirst Clinics', code: 'HFC', type: OrganizationType.CLINIC },
        ];

        let savedOrganizations: Organization[] = [];
        for (const orgData of organizationDatas) {
            let org = await organizationRepository.findOne({ where: { name: orgData.name } });
            if (!org) {
                org = organizationRepository.create({
                    name: orgData.name,
                    code: orgData.code,
                    type: orgData.type,
                    is_active: true,
                });
                org = await organizationRepository.save(org);
                console.log('✅ Organization created:', org.name);

                // Audit: Organization creation
                await auditLogRepository.save({
                    user_id: null as unknown as number,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.FACILITY,
                    entity_id: org.id,
                    entity_name: org.name,
                    description: `Organization ${org.name} created`,
                    new_values: { type: orgData.type },
                    ip_address: '127.0.0.1',
                });
            }
            savedOrganizations.push(org);
        }

        // ============================================
        // 2. CREATE FACILITIES
        // ============================================
        console.log('\n📍 Creating Facilities...');
        const facilityDatas = [
            {
                name: 'Kigali Central Pharmacy',
                orgIndex: 1,
                type: FacilityType.PHARMACY_SHOP,
                address: 'KN 3 Rd, Kigali, Rwanda',
                phone: '+250788333444',
            },
            {
                name: 'Dar es Salaam Medical Center',
                orgIndex: 0,
                type: FacilityType.HOSPITAL,
                address: 'Dar es Salaam, Tanzania',
                phone: '+255745123456',
            },
            {
                name: 'Nairobi Clinic',
                orgIndex: 0,
                type: FacilityType.CLINIC,
                address: 'Westlands, Nairobi, Kenya',
                phone: '+254722987654',
            },
            {
                name: 'Kampala Pharmacy Plus',
                orgIndex: 2,
                type: FacilityType.PHARMACY_SHOP,
                address: 'Kampala, Uganda',
                phone: '+256701234567',
            },
        ];

        let savedFacilities: Facility[] = [];
        for (const facData of facilityDatas) {
            let facility = await facilityRepository.findOne({ where: { name: facData.name } });
            if (!facility) {
                facility = facilityRepository.create({
                    name: facData.name,
                    address: facData.address,
                    phone: facData.phone,
                    email: facData.name.toLowerCase().replace(/ /g, '') + '@tangacare.com',
                    type: facData.type,
                    organization_id: savedOrganizations[facData.orgIndex].id,
                    is_active: true,
                    configuration: { theme: 'light', currency: 'RWF' },
                });
                facility = await facilityRepository.save(facility);
                console.log('✅ Facility created:', facility.name);

                // Audit: Facility creation
                await auditLogRepository.save({
                    facility_id: facility.id,
                    user_id: null as unknown as number,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.FACILITY,
                    entity_id: facility.id,
                    entity_name: facility.name,
                    description: `Facility ${facility.name} created`,
                    new_values: { type: facData.type },
                    ip_address: '127.0.0.1',
                });
            }
            savedFacilities.push(facility);
        }

        // ============================================
        // 3. CREATE USERS WITH ALL ROLES
        // ============================================
        console.log('\n📍 Creating Users with all roles...');
        const userRoles = [
            {
                email: 'admin@tangacare.com',
                role: UserRole.ADMIN,
                first: 'Global',
                last: 'Admin',
                facility_id: null,
                org_id: null,
            },
            {
                email: 'facilityadmin1@tangacare.com',
                role: UserRole.FACILITY_ADMIN,
                first: 'Facility1',
                last: 'Admin',
                facility_id: 0,
                org_id: 1,
            },
            {
                email: 'facilityadmin2@tangacare.com',
                role: UserRole.FACILITY_ADMIN,
                first: 'Facility2',
                last: 'Admin',
                facility_id: 1,
                org_id: 0,
            },
            {
                email: 'owner@tangacare.com',
                role: UserRole.OWNER,
                first: 'Business',
                last: 'Owner',
                facility_id: 0,
                org_id: 1,
            },
            {
                email: 'pharmacist1@tangacare.com',
                role: UserRole.PHARMACIST,
                first: 'Main',
                last: 'Pharmacist',
                facility_id: 0,
                org_id: 1,
            },
            {
                email: 'pharmacist2@tangacare.com',
                role: UserRole.PHARMACIST,
                first: 'Senior',
                last: 'Pharmacist',
                facility_id: 1,
                org_id: 0,
            },
            {
                email: 'storemanager@tangacare.com',
                role: UserRole.STORE_MANAGER,
                first: 'Stock',
                last: 'Manager',
                facility_id: 0,
                org_id: 1,
            },
            {
                email: 'cashier@tangacare.com',
                role: UserRole.CASHIER,
                first: 'Till',
                last: 'Operator',
                facility_id: 0,
                org_id: 1,
            },
            {
                email: 'auditor@tangacare.com',
                role: UserRole.AUDITOR,
                first: 'Compliance',
                last: 'Auditor',
                facility_id: 0,
                org_id: 1,
            },
            {
                email: 'doctor1@tangacare.com',
                role: UserRole.DOCTOR,
                first: 'Dr. Jean',
                last: 'Mugisha',
                facility_id: 2,
                org_id: 0,
            },
            {
                email: 'doctor2@tangacare.com',
                role: UserRole.DOCTOR,
                first: 'Dr. Mary',
                last: 'Aline',
                facility_id: 2,
                org_id: 0,
            },
            {
                email: 'patient1@tangacare.com',
                role: UserRole.PATIENT,
                first: 'John',
                last: 'Patient',
                facility_id: null,
                org_id: null,
            },
            {
                email: 'patient2@tangacare.com',
                role: UserRole.PATIENT,
                first: 'Jane',
                last: 'Patient',
                facility_id: null,
                org_id: null,
            },
            {
                email: 'patient3@tangacare.com',
                role: UserRole.PATIENT,
                first: 'Peter',
                last: 'Patient',
                facility_id: null,
                org_id: null,
            },
            {
                email: 'user@tangacare.com',
                role: UserRole.USER,
                first: 'Generic',
                last: 'User',
                facility_id: null,
                org_id: null,
            },
        ];

        let savedUsers: { [key: string]: User } = {};
        for (const roleData of userRoles) {
            const existingUser = await userRepository.findOne({ where: { email: roleData.email } });
            if (!existingUser) {
                const userData: any = {
                    email: roleData.email,
                    phone_number: `+25078${Math.floor(1000000 + Math.random() * 9000000)}`,
                    password_hash,
                    first_name: roleData.first,
                    last_name: roleData.last,
                    role: roleData.role,
                    is_verified: true,
                    gender: roleData.role === UserRole.PATIENT && Math.random() > 0.5 ? 'female' : 'male',
                    date_of_birth: new Date(1980 + Math.random() * 30, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
                    preferred_language: 'en',
                };

                if (roleData.org_id !== null) {
                    userData.organization_id = savedOrganizations[roleData.org_id].id;
                }
                if (roleData.facility_id !== null) {
                    userData.facility_id = savedFacilities[roleData.facility_id].id;
                }
                if ([UserRole.DOCTOR, UserRole.PHARMACIST].includes(roleData.role)) {
                    userData.professional_title = 'Dr.';
                }

                const newUser: any = userRepository.create(userData);
                const user: User = await userRepository.save(newUser);
                savedUsers[roleData.email] = user;
                console.log(`✅ ${roleData.role} user created:`, user.email);

                // Audit: User creation
                await auditLogRepository.save({
                    facility_id: user.facility_id,
                    user_id: (savedUsers['admin@tangacare.com']?.id ?? null) as unknown as number,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.USER,
                    entity_id: user.id,
                    entity_name: `${user.first_name} ${user.last_name}`,
                    description: `User ${user.email} created with role ${roleData.role}`,
                    new_values: { role: roleData.role },
                    ip_address: '127.0.0.1',
                });
            } else {
                savedUsers[roleData.email] = existingUser;
            }
        }

        const seedActorUserId =
            savedUsers['admin@tangacare.com']?.id ??
            (await userRepository.findOne({ where: { email: 'admin@tangacare.com' } }))?.id ??
            null;

        // ============================================
        // 4. CREATE DOCTOR PROFILES FOR DOCTORS
        // ============================================
        console.log('\n📍 Creating Doctor profiles...');
        const doctorUsers = Object.values(savedUsers).filter(u => u.role === UserRole.DOCTOR);
        const specializations = ['General Practice', 'Cardiology', 'Dermatology', 'Pediatrics'];

        for (let i = 0; i < doctorUsers.length; i++) {
            const doctorUser = doctorUsers[i];
            const doctorExists = await doctorRepository.findOne({ where: { user_id: doctorUser.id } });
            if (!doctorExists) {
                const doctorProfile = doctorRepository.create({
                    user_id: doctorUser.id,
                    license_number: `RMDC-${String(i + 1).padStart(3, '0')}/2023`,
                    specialization: specializations[i % specializations.length],
                    years_of_experience: 3 + (i * 2),
                    consultation_fee: 5000 + (i * 1000),
                    is_available: true,
                    user: doctorUser,
                });
                await doctorRepository.save(doctorProfile);
                console.log('✅ Doctor profile created:', doctorProfile.license_number);
            }
        }

        // ============================================
        // 5. CREATE MEDICINES
        // ============================================
        console.log('\n📍 Creating Medicines...');
        const medicinesData = [
            { code: 'PARA-500', name: 'Paracetamol', dosage: DosageForm.TABLET, strength: '500mg', price: 100 },
            { code: 'AMOX-250', name: 'Amoxicillin', dosage: DosageForm.CAPSULE, strength: '250mg', price: 500 },
            { code: 'IBU-400', name: 'Ibuprofen', dosage: DosageForm.TABLET, strength: '400mg', price: 200 },
            { code: 'CETI-100', name: 'Cetirizine', dosage: DosageForm.SYRUP, strength: '5mg/5ml', price: 1500 },
            { code: 'METRO-400', name: 'Metronidazole', dosage: DosageForm.TABLET, strength: '400mg', price: 300 },
            { code: 'ASPX-100', name: 'Aspirin', dosage: DosageForm.TABLET, strength: '100mg', price: 150 },
            { code: 'DOXO-100', name: 'Doxycycline', dosage: DosageForm.CAPSULE, strength: '100mg', price: 800 },
            { code: 'CIPX-500', name: 'Ciprofloxacin', dosage: DosageForm.TABLET, strength: '500mg', price: 1200 },
        ];

        let savedMedicines: Medicine[] = [];
        for (const medData of medicinesData) {
            let medicine = await medicineRepository.findOne({ where: { code: medData.code } });
            if (!medicine) {
                medicine = medicineRepository.create({
                    code: medData.code,
                    name: medData.name,
                    dosage_form: medData.dosage,
                    strength: medData.strength,
                    selling_price: medData.price,
                    is_active: true,
                    unit: medData.dosage === DosageForm.SYRUP ? 'bottle' : 'pack',
                });
                medicine = await medicineRepository.save(medicine);
                savedMedicines.push(medicine);
                console.log('✅ Medicine created:', medicine.name);

                // Audit: Medicine creation
                await auditLogRepository.save({
                    user_id: (seedActorUserId ?? null) as unknown as number,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.MEDICINE,
                    entity_id: medicine.id,
                    entity_name: medicine.name,
                    description: `Medicine ${medicine.name} created`,
                    new_values: { price: medData.price },
                    ip_address: '127.0.0.1',
                });
            } else {
                savedMedicines.push(medicine);
            }
        }

        // ============================================
        // 6. CREATE SUPPLIERS
        // ============================================
        console.log('\n📍 Creating Suppliers...');
        const supplierNames = ['Medisell Ltd', 'Ubuzima Pharma', 'Global Health Supplies', 'PharmaDist Africa', 'Premier Medical'];
        let savedSuppliers: Supplier[] = [];

        for (let i = 0; i < supplierNames.length; i++) {
            const name = supplierNames[i];
            let supplier = await supplierRepository.findOne({ where: { name } });
            if (!supplier) {
                supplier = supplierRepository.create({
                    name,
                    contact_person: `Contact ${i + 1}`,
                    phone: `+250788${String(400000 + i * 100000).slice(-6)}`,
                    email: `contact@${name.toLowerCase().replace(/ /g, '')}.com`,
                    facility_id: savedFacilities[i % savedFacilities.length].id,
                    is_active: true,
                });
                supplier = await supplierRepository.save(supplier);
                savedSuppliers.push(supplier);
                console.log('✅ Supplier created:', name);

                // Audit: Supplier creation
                await auditLogRepository.save({
                    facility_id: supplier.facility_id,
                    user_id: (seedActorUserId ?? null) as unknown as number,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.SUPPLIER,
                    entity_id: supplier.id,
                    entity_name: supplier.name,
                    description: `Supplier ${name} created`,
                    new_values: { contact: supplier.contact_person },
                    ip_address: '127.0.0.1',
                });
            } else {
                savedSuppliers.push(supplier);
            }
        }

        // ============================================
        // 7. CREATE BATCHES AND STOCK
        // ============================================
        console.log('\n📍 Creating Batches and Stock...');
        for (let facIdx = 0; facIdx < Math.min(2, savedFacilities.length); facIdx++) {
            const facility = savedFacilities[facIdx];

            for (let medIdx = 0; medIdx < savedMedicines.length; medIdx++) {
                const medicine = savedMedicines[medIdx];
                const batchNumber = `BCH-${facIdx}-${medIdx}-${Math.floor(1000 + Math.random() * 9000)}`;

                const batchExists = await batchRepository.findOne({ where: { batch_number: batchNumber } });
                if (!batchExists) {
                    const batch = batchRepository.create({
                        medicine_id: medicine.id,
                        batch_number: batchNumber,
                        expiry_date: new Date(2026 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), 1),
                        manufacturing_date: new Date(2024, Math.floor(Math.random() * 12), 1),
                        initial_quantity: 500 + Math.floor(Math.random() * 1500),
                        current_quantity: Math.floor((500 + Math.random() * 1500) * 0.8),
                        unit_cost: medicine.selling_price * 0.65,
                        supplier: savedSuppliers[medIdx % savedSuppliers.length].name,
                    });
                    const savedBatch = await batchRepository.save(batch);

                    const stock = stockRepository.create({
                        facility_id: facility.id,
                        medicine_id: medicine.id,
                        batch_id: savedBatch.id,
                        quantity: Math.floor((500 + Math.random() * 1500) * 0.8),
                        unit_cost: medicine.selling_price * 0.65,
                        unit_price: medicine.selling_price,
                    });
                    await stockRepository.save(stock);
                    console.log(`✅ Stock created for ${medicine.name} at ${facility.name}`);

                    // Audit: Batch and Stock creation
                    await auditLogRepository.save({
                        facility_id: facility.id,
                        user_id: (savedUsers['storemanager@tangacare.com']?.id ??
                            seedActorUserId ??
                            null) as unknown as number,
                        action: AuditAction.RECEIVE,
                        entity_type: AuditEntityType.BATCH,
                        entity_id: savedBatch.id,
                        entity_name: batchNumber,
                        description: `Batch ${batchNumber} received and stock created`,
                        new_values: { quantity: stock.quantity },
                        ip_address: '127.0.0.1',
                    });
                }
            }
        }

        // ============================================
        // 8. CREATE APPOINTMENTS (For Doctors)
        // ============================================
        console.log('\n📍 Creating Appointments...');
        const patients = Object.values(savedUsers).filter(u => u.role === UserRole.PATIENT);
        const doctors = Object.values(savedUsers).filter(u => u.role === UserRole.DOCTOR);

        for (let i = 0; i < Math.min(3, patients.length * doctors.length); i++) {
            const patientIdx = i % patients.length;
            const doctorIdx = i % doctors.length;
            const patient = patients[patientIdx];
            const doctor = doctors[doctorIdx];
            const appointmentDate = new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1);

            const appointment = appointmentRepository.create({
                patient_id: patient.id,
                doctor_id: doctor.id,
                appointment_date: appointmentDate,
                consultation_type: ['video', 'audio', 'text'][Math.floor(Math.random() * 3)] as any,
                status: [AppointmentStatus.SCHEDULED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED][Math.floor(Math.random() * 3)],
                notes: 'Test appointment for seed data',
            });
            try {
                const savedAppointment = await appointmentRepository.save(appointment);
                console.log(`✅ Appointment created: ${patient.first_name} with ${doctor.first_name}`);

                // Audit: Appointment creation
                await auditLogRepository.save({
                    user_id: doctor.id,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.FACILITY,
                    entity_id: savedAppointment.id,
                    entity_name: `Appointment ${savedAppointment.id}`,
                    description: `Appointment scheduled between ${patient.first_name} and ${doctor.first_name}`,
                    new_values: { status: 'scheduled' },
                    ip_address: '127.0.0.1',
                });
            } catch (e) {
                // Appointment table might not have all columns required
                console.log('⚠️  Appointment creation skipped (schema might be incomplete)');
            }
        }

        // ============================================
        // 9. CREATE PURCHASE ORDERS
        // ============================================
        console.log('\n📍 Creating Purchase Orders...');
        for (let i = 0; i < Math.min(3, savedFacilities.length); i++) {
            const facility = savedFacilities[i];
            const supplier = savedSuppliers[i % savedSuppliers.length];

            const poCreatorId = savedUsers['storemanager@tangacare.com']?.id ?? seedActorUserId;
            if (!poCreatorId) {
                console.log('⚠️  Purchase Order creation skipped (no seed user id for created_by)');
                continue;
            }

            const po = purchaseOrderRepository.create({
                facility_id: facility.id,
                supplier_id: supplier.id,
                order_number: `PO-${facility.id}-${Date.now()}`,
                status: [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.APPROVED, PurchaseOrderStatus.RECEIVED][Math.floor(Math.random() * 3)],
                total_amount: Math.floor(Math.random() * 500000) + 50000,
                created_by_id: poCreatorId,
                order_date: new Date(),
            });

            try {
                const savedPO = await purchaseOrderRepository.save(po);
                console.log(`✅ Purchase Order created: ${po.order_number}`);

                // Audit: PO creation
                await auditLogRepository.save({
                    facility_id: facility.id,
                    user_id: poCreatorId,
                    action: AuditAction.CREATE,
                    entity_type: AuditEntityType.PURCHASE_ORDER,
                    entity_id: savedPO.id,
                    entity_name: po.order_number,
                    description: `Purchase Order created from ${supplier.name}`,
                    new_values: { status: po.status, amount: po.total_amount },
                    ip_address: '127.0.0.1',
                });
            } catch (e) {
                console.log('⚠️  Purchase Order creation skipped');
            }
        }

        // ============================================
        // 10. CREATE STOCK MOVEMENTS (DISPENSE)
        // ============================================
        console.log('\n📍 Creating Stock Movements...');
        for (let i = 0; i < Math.min(5, savedMedicines.length); i++) {
            const medicine = savedMedicines[i];
            const facility = savedFacilities[0];
            const stock = await stockRepository.findOne({
                where: { medicine_id: medicine.id, facility_id: facility.id },
            });

            if (stock && stock.quantity > 10) {
                const dispenseUserId =
                    savedUsers['pharmacist1@tangacare.com']?.id ?? seedActorUserId ?? null;
                const movement = stockMovementRepository.create({
                    facility_id: facility.id,
                    medicine_id: medicine.id,
                    batch_id: stock.batch_id,
                    type: StockMovementType.OUT,
                    quantity: 10,
                    previous_balance: stock.quantity,
                    new_balance: stock.quantity - 10,
                    reference_type: 'dispense',
                    user_id: dispenseUserId,
                    notes: 'Dispensed to patient',
                });

                try {
                    const savedMovement = await stockMovementRepository.save(movement);
                    console.log(`✅ Stock movement created for ${medicine.name}`);

                    // Audit: Dispense action
                    await auditLogRepository.save({
                        facility_id: facility.id,
                        user_id: (dispenseUserId ?? null) as unknown as number,
                        action: AuditAction.DISPENSE,
                        entity_type: AuditEntityType.STOCK,
                        entity_id: savedMovement.id,
                        entity_name: medicine.name,
                        description: `${medicine.name} dispensed - Qty: 10`,
                        new_values: { quantity: 10 },
                        ip_address: '127.0.0.1',
                    });
                } catch (e) {
                    console.log('⚠️  Stock movement creation skipped');
                }
            }
        }

        // ============================================
        // 11. CREATE AUDIT LOG ENTRIES FOR ALL ACTIONS
        // ============================================
        console.log('\n📍 Creating comprehensive Audit Logs...');
        const auditActions = [
            AuditAction.LOGIN,
            AuditAction.LOGOUT,
            AuditAction.UPDATE,
            AuditAction.DELETE,
            AuditAction.TRANSFER,
            AuditAction.ADJUSTMENT,
            AuditAction.ACCESS_DENIED,
            AuditAction.FEFO_VIOLATION,
        ];

        const auditEntities = [
            AuditEntityType.DEPARTMENT,
            AuditEntityType.VENDOR_RETURN,
            AuditEntityType.DISPOSAL_REQUEST,
            AuditEntityType.GOODS_RECEIPT,
            AuditEntityType.SALE,
            AuditEntityType.STOCK_TRANSFER,
            AuditEntityType.ALERT,
        ];

        for (let actionIdx = 0; actionIdx < auditActions.length; actionIdx++) {
            const action = auditActions[actionIdx];
            const entityType = auditEntities[actionIdx % auditEntities.length];
            const randomUser = Object.values(savedUsers)[Math.floor(Math.random() * Object.keys(savedUsers).length)];
            const randomFacility = savedFacilities[Math.floor(Math.random() * savedFacilities.length)];

            await auditLogRepository.save({
                facility_id: randomFacility.id,
                user_id: (randomUser?.id ?? seedActorUserId ?? null) as unknown as number,
                action: action,
                entity_type: entityType,
                entity_id: Math.floor(Math.random() * 100) + 1,
                entity_name: `Sample ${entityType}`,
                description: `Sample audit log for ${action} on ${entityType}`,
                new_values: { action: action, timestamp: new Date() },
                old_values: { previous_state: 'initial' },
                ip_address: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                user_agent: 'Mozilla/5.0 (Test Browser)',
            });
        }
        console.log(`✅ ${auditActions.length} comprehensive audit logs created`);

        // ============================================
        // 12. CREATE SALES
        // ============================================
        console.log('\n📍 Creating Sales...');
        for (let i = 0; i < Math.min(3, savedFacilities.length); i++) {
            const facility = savedFacilities[i];
            const medicine = savedMedicines[i % savedMedicines.length];
            const stock = await stockRepository.findOne({
                where: { medicine_id: medicine.id, facility_id: facility.id },
            });

            if (stock && stock.quantity > 5) {
                const cashierId = savedUsers['cashier@tangacare.com']?.id ?? seedActorUserId;
                if (!cashierId) {
                    console.log('⚠️  Sale creation skipped (no seed user id for cashier)');
                    continue;
                }

                const sale = saleRepository.create({
                    facility_id: facility.id,
                    cashier_id: cashierId,
                    sale_number: `SALE-${i}-${Date.now()}`,
                    subtotal: stock.unit_price * 5,
                    vat_amount: 0,
                    total_amount: stock.unit_price * 5,
                    status: SaleStatus.PAID,
                });

                try {
                    const savedSale = await saleRepository.save(sale);
                    console.log(`✅ Sale created: ${medicine.name} x5`);

                    // Audit: Sale creation
                    await auditLogRepository.save({
                        facility_id: facility.id,
                        user_id: cashierId,
                        action: AuditAction.CREATE,
                        entity_type: AuditEntityType.SALE,
                        entity_id: savedSale.id,
                        entity_name: `${medicine.name} Sale`,
                        description: `Sale of ${medicine.name} - Qty: 5, Amount: ${sale.total_amount}`,
                        new_values: { quantity: 5, amount: sale.total_amount },
                        ip_address: '127.0.0.1',
                    });
                } catch (e) {
                    console.log('⚠️  Sale creation skipped');
                }
            }
        }

        console.log('\n✨ Comprehensive seeding completed successfully!');
        console.log('🎯 Summary:');
        console.log(`  - Users: ${Object.keys(savedUsers).length} (All roles covered)`);
        console.log(`  - Facilities: ${savedFacilities.length}`);
        console.log(`  - Organizations: ${savedOrganizations.length}`);
        console.log(`  - Medicines: ${savedMedicines.length}`);
        console.log(`  - Suppliers: ${savedSuppliers.length}`);
        console.log(`  - Audit Actions: ${auditActions.length + 3} (CREATE, RECEIVE, DISPENSE + ${auditActions.length} more)`);
        console.log(`  - Audit Entities: ${auditEntities.length + 3} (Additional core entities + ${auditEntities.length} more)`);
        console.log('\n🔑 Default Password: Tangahub@2025');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error during seeding:', error);
        process.exit(1);
    }
};

seed();
