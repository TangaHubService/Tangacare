import { Repository } from 'typeorm';
import { DoctorReview } from '../entities/DoctorReview.entity';
import { Appointment, AppointmentStatus } from '../entities/Appointment.entity';
import { Doctor } from '../entities/Doctor.entity';
import { AppDataSource } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { CreateReviewDto, UpdateReviewDto } from '../dto/review.dto';

export class ReviewService {
    private reviewRepository: Repository<DoctorReview>;
    private appointmentRepository: Repository<Appointment>;
    private doctorRepository: Repository<Doctor>;

    constructor() {
        this.reviewRepository = AppDataSource.getRepository(DoctorReview);
        this.appointmentRepository = AppDataSource.getRepository(Appointment);
        this.doctorRepository = AppDataSource.getRepository(Doctor);
    }

    async createReview(patientId: number, createReviewDto: CreateReviewDto): Promise<DoctorReview> {
        const appointment = await this.appointmentRepository.findOne({
            where: { id: createReviewDto.appointment_id },
            relations: ['doctor'],
        });

        if (!appointment) {
            throw new AppError('Appointment not found', 404);
        }

        if (appointment.patient_id !== patientId) {
            throw new AppError('Unauthorized to review this appointment', 403);
        }

        if (appointment.status !== AppointmentStatus.COMPLETED) {
            throw new AppError('Can only review completed appointments', 400);
        }

        const existingReview = await this.reviewRepository.findOne({
            where: { appointment_id: createReviewDto.appointment_id },
        });

        if (existingReview) {
            throw new AppError('Review already exists for this appointment', 409);
        }

        const review = this.reviewRepository.create({
            ...createReviewDto,
            patient_id: patientId,
            doctor_id: appointment.doctor_id,
        });

        await this.reviewRepository.save(review);

        await this.updateDoctorRating(appointment.doctor_id);

        return review;
    }

    async getReviewsByDoctor(doctorId: number): Promise<DoctorReview[]> {
        return this.reviewRepository.find({
            where: { doctor_id: doctorId },
            relations: ['patient'],
            order: { created_at: 'DESC' },
        });
    }

    async getFeaturedReviews(limit: number = 10): Promise<DoctorReview[]> {
        return this.reviewRepository.find({
            where: { is_featured: true },
            relations: ['patient', 'doctor', 'doctor.user'],
            order: { created_at: 'DESC' },
            take: limit,
        });
    }

    async updateReview(reviewId: number, patientId: number, updateReviewDto: UpdateReviewDto): Promise<DoctorReview> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new AppError('Review not found', 404);
        }

        if (review.patient_id !== patientId) {
            throw new AppError('Unauthorized to update this review', 403);
        }

        Object.assign(review, updateReviewDto);
        await this.reviewRepository.save(review);

        if (updateReviewDto.rating) {
            await this.updateDoctorRating(review.doctor_id);
        }

        return review;
    }

    async deleteReview(reviewId: number, patientId: number): Promise<void> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new AppError('Review not found', 404);
        }

        if (review.patient_id !== patientId) {
            throw new AppError('Unauthorized to delete this review', 403);
        }

        const doctorId = review.doctor_id;
        await this.reviewRepository.remove(review);

        await this.updateDoctorRating(doctorId);
    }

    private async updateDoctorRating(doctorId: number): Promise<void> {
        const reviews = await this.reviewRepository.find({
            where: { doctor_id: doctorId },
        });

        if (reviews.length === 0) {
            await this.doctorRepository.update(doctorId, { rating: 0 });
            return;
        }

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / reviews.length;

        await this.doctorRepository.update(doctorId, {
            rating: Math.round(averageRating * 100) / 100,
        });
    }
}
