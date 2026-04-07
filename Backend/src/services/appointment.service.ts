import { Repository, Between } from 'typeorm';
import { Appointment, AppointmentStatus, ConsultationType } from '../entities/Appointment.entity';
import { AppDataSource } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateAppointmentDto, UpdateAppointmentDto } from '../dto/index.dto';
import { Doctor } from '../entities/Doctor.entity';
import { requireOrganizationId } from '../utils/tenant.util';

export class AppointmentService {
    private appointmentRepository: Repository<Appointment>;
    private doctorRepository: Repository<Doctor>;

    constructor() {
        this.appointmentRepository = AppDataSource.getRepository(Appointment);
        this.doctorRepository = AppDataSource.getRepository(Doctor);
    }

    async create(patientId: number, organizationId: number, createAppointmentDto: CreateAppointmentDto): Promise<Appointment> {
        organizationId = requireOrganizationId(organizationId);
        const appointmentDate = new Date(createAppointmentDto.appointment_date);
        const endTime = new Date(appointmentDate.getTime() + (createAppointmentDto.duration_minutes || 15) * 60000);

        const doctor = await this.doctorRepository.findOne({
            where: { id: createAppointmentDto.doctor_id, user: { organization_id: organizationId } },
            relations: ['user'],
        });

        if (!doctor) {
            throw new AppError('Doctor not found in your organization', 404);
        }

        const conflictingAppointment = await this.appointmentRepository
            .createQueryBuilder('appointment')
            .where('appointment.doctor_id = :doctorId', { doctorId: createAppointmentDto.doctor_id })
            .andWhere('appointment.organization_id = :organizationId', { organizationId })
            .andWhere('appointment.status = :status', { status: AppointmentStatus.SCHEDULED })
            .andWhere('appointment.appointment_date < :endTime', { endTime })
            .andWhere(
                "appointment.appointment_date + COALESCE(appointment.duration_minutes, 15) * interval '1 minute' > :startTime",
                { startTime: appointmentDate },
            )
            .getOne();

        if (conflictingAppointment) {
            throw new AppError('Doctor is not available at this time', 409);
        }

        const appointment = this.appointmentRepository.create({
            ...createAppointmentDto,
            consultation_type: createAppointmentDto.consultation_type as ConsultationType,
            patient_id: patientId,
            organization_id: organizationId,
            appointment_date: appointmentDate,
        });

        return await this.appointmentRepository.save(appointment);
    }

    async findAll(filters?: {
        patient_id?: number;
        doctor_id?: number;
        status?: string;
        facility_id?: number;
        organization_id?: number;
    }): Promise<Appointment[]> {
        const organizationId = requireOrganizationId(filters?.organization_id);
        const query = this.appointmentRepository
            .createQueryBuilder('appointment')
            .leftJoinAndSelect('appointment.patient', 'patient')
            .leftJoinAndSelect('appointment.doctor', 'doctor')
            .leftJoinAndSelect('doctor.user', 'doctorUser')
            .where('appointment.organization_id = :organizationId', { organizationId });

        if (filters?.patient_id) {
            query.andWhere('appointment.patient_id = :patient_id', { patient_id: filters.patient_id });
        }

        if (filters?.doctor_id) {
            query.andWhere('appointment.doctor_id = :doctor_id', { doctor_id: filters.doctor_id });
        }

        if (filters?.status) {
            query.andWhere('appointment.status = :status', { status: filters.status });
        }

        if (filters?.facility_id) {
            query.andWhere('doctorUser.facility_id = :facility_id', { facility_id: filters.facility_id });
        }

        return await query.orderBy('appointment.appointment_date', 'DESC').getMany();
    }

    async findOne(id: number, organizationId: number): Promise<Appointment> {
        const appointment = await this.appointmentRepository.findOne({
            where: { id, organization_id: requireOrganizationId(organizationId) },
            relations: ['patient', 'doctor', 'doctor.user'],
        });

        if (!appointment) {
            throw new AppError('Appointment not found', 404);
        }

        return appointment;
    }

    async update(id: number, organizationId: number, updateAppointmentDto: UpdateAppointmentDto): Promise<Appointment> {
        const appointment = await this.findOne(id, organizationId);

        if (updateAppointmentDto.appointment_date) {
            appointment.appointment_date = new Date(updateAppointmentDto.appointment_date);
        }

        if (updateAppointmentDto.status) {
            appointment.status = updateAppointmentDto.status as AppointmentStatus;
        }

        if (updateAppointmentDto.notes) {
            appointment.notes = updateAppointmentDto.notes;
        }

        return await this.appointmentRepository.save(appointment);
    }

    async delete(id: number, organizationId: number): Promise<void> {
        const appointment = await this.findOne(id, organizationId);
        appointment.status = AppointmentStatus.CANCELLED;
        await this.appointmentRepository.save(appointment);
    }

    async checkAvailability(doctorId: number, organizationId: number, date: string): Promise<any[]> {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

        const appointments = await this.appointmentRepository.find({
            where: {
                doctor_id: doctorId,
                organization_id: requireOrganizationId(organizationId),
                status: AppointmentStatus.SCHEDULED,
                appointment_date: Between(startOfDay, endOfDay),
            },
            order: { appointment_date: 'ASC' },
        });

        return appointments.map((apt) => ({
            start: apt.appointment_date,
            end: new Date(apt.appointment_date.getTime() + apt.duration_minutes * 60000),
        }));
    }
}
