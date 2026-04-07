import { Repository } from 'typeorm';
import { Prescription } from '../entities/Prescription.entity';
import { AppDataSource } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreatePrescriptionDto } from '../dto/index.dto';

export class PrescriptionService {
    private prescriptionRepository: Repository<Prescription>;

    constructor() {
        this.prescriptionRepository = AppDataSource.getRepository(Prescription);
    }

    async create(createPrescriptionDto: CreatePrescriptionDto): Promise<Prescription> {
        const prescription = this.prescriptionRepository.create(createPrescriptionDto);
        return await this.prescriptionRepository.save(prescription);
    }

    async findAll(filters?: { patient_id?: number; doctor_id?: number }): Promise<Prescription[]> {
        const query = this.prescriptionRepository
            .createQueryBuilder('prescription')
            .leftJoinAndSelect('prescription.patient', 'patient')
            .leftJoinAndSelect('prescription.doctor', 'doctor')
            .leftJoinAndSelect('prescription.appointment', 'appointment');

        if (filters?.patient_id) {
            query.andWhere('prescription.patient_id = :patient_id', { patient_id: filters.patient_id });
        }

        if (filters?.doctor_id) {
            query.andWhere('prescription.doctor_id = :doctor_id', { doctor_id: filters.doctor_id });
        }

        return await query.orderBy('prescription.issued_at', 'DESC').getMany();
    }

    async findOne(id: number): Promise<Prescription> {
        const prescription = await this.prescriptionRepository.findOne({
            where: { id },
            relations: ['patient', 'doctor', 'appointment'],
        });

        if (!prescription) {
            throw new AppError('Prescription not found', 404);
        }

        return prescription;
    }
}

export class PaymentService {
    private paymentRepository: Repository<any>;

    constructor() {
        this.paymentRepository = AppDataSource.getRepository('Payment');
    }

    async initiate(patientId: number, createPaymentDto: any): Promise<any> {
        const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const payment = this.paymentRepository.create({
            ...createPaymentDto,
            patient_id: patientId,
            transaction_id: transactionId,
        });

        return await this.paymentRepository.save(payment);
    }

    async findAll(filters?: { patient_id?: number }): Promise<any[]> {
        const query = this.paymentRepository
            .createQueryBuilder('payment')
            .leftJoinAndSelect('payment.patient', 'patient')
            .leftJoinAndSelect('payment.appointment', 'appointment');

        if (filters?.patient_id) {
            query.andWhere('payment.patient_id = :patient_id', { patient_id: filters.patient_id });
        }

        return await query.orderBy('payment.created_at', 'DESC').getMany();
    }

    async findOne(id: number): Promise<any> {
        const payment = await this.paymentRepository.findOne({
            where: { id },
            relations: ['patient', 'appointment'],
        });

        if (!payment) {
            throw new AppError('Payment not found', 404);
        }

        return payment;
    }

    async handleWebhook(data: any): Promise<void> {
        console.log('Payment webhook received:', data);
    }
}

export class HealthRecordService {
    private healthRecordRepository: Repository<any>;

    constructor() {
        this.healthRecordRepository = AppDataSource.getRepository('HealthRecord');
    }

    async create(patientId: number, createHealthRecordDto: any): Promise<any> {
        const healthRecord = this.healthRecordRepository.create({
            ...createHealthRecordDto,
            patient_id: patientId,
        });

        return await this.healthRecordRepository.save(healthRecord);
    }

    async findAll(patientId: number): Promise<any[]> {
        return await this.healthRecordRepository.find({
            where: { patient_id: patientId },
            order: { created_at: 'DESC' },
        });
    }

    async findOne(id: number, patientId: number): Promise<any> {
        const healthRecord = await this.healthRecordRepository.findOne({
            where: { id, patient_id: patientId },
        });

        if (!healthRecord) {
            throw new AppError('Health record not found', 404);
        }

        return healthRecord;
    }

    async update(id: number, patientId: number, updateData: any): Promise<any> {
        const healthRecord = await this.findOne(id, patientId);
        Object.assign(healthRecord, updateData);
        return await this.healthRecordRepository.save(healthRecord);
    }

    async delete(id: number, patientId: number): Promise<void> {
        const healthRecord = await this.findOne(id, patientId);
        await this.healthRecordRepository.remove(healthRecord);
    }
}

export class HealthTipService {
    private healthTipRepository: Repository<any>;

    constructor() {
        this.healthTipRepository = AppDataSource.getRepository('HealthTip');
    }

    async create(authorId: number, createHealthTipDto: any): Promise<any> {
        const healthTip = this.healthTipRepository.create({
            ...createHealthTipDto,
            author_id: authorId,
        });

        return await this.healthTipRepository.save(healthTip);
    }

    async findAll(filters?: { category?: string; language?: string }): Promise<any[]> {
        const query = this.healthTipRepository
            .createQueryBuilder('healthTip')
            .where('healthTip.is_published = :is_published', { is_published: true });

        if (filters?.category) {
            query.andWhere('healthTip.category = :category', { category: filters.category });
        }

        if (filters?.language) {
            query.andWhere('healthTip.language = :language', { language: filters.language });
        }

        return await query.orderBy('healthTip.published_at', 'DESC').getMany();
    }

    async findOne(id: number): Promise<any> {
        const healthTip = await this.healthTipRepository.findOne({
            where: { id },
            relations: ['author'],
        });

        if (!healthTip) {
            throw new AppError('Health tip not found', 404);
        }

        return healthTip;
    }

    async update(id: number, updateData: any): Promise<any> {
        const healthTip = await this.findOne(id);
        Object.assign(healthTip, updateData);
        return await this.healthTipRepository.save(healthTip);
    }

    async delete(id: number): Promise<void> {
        const healthTip = await this.findOne(id);
        await this.healthTipRepository.remove(healthTip);
    }
}
