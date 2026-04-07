import { ReviewService } from '../../services/review.service';
import { AppDataSource } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { CreateReviewDto, UpdateReviewDto } from '../../dto/review.dto';
import { AppointmentStatus } from '../../entities/Appointment.entity';

jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(),
    },
}));

describe('ReviewService', () => {
    let reviewService: ReviewService;
    let mockReviewRepository: any;
    let mockAppointmentRepository: any;
    let mockDoctorRepository: any;

    beforeEach(() => {
        mockReviewRepository = {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            remove: jest.fn(),
        };

        mockAppointmentRepository = {
            findOne: jest.fn(),
        };

        mockDoctorRepository = {
            update: jest.fn(),
        };

        (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
            if (entity.name === 'DoctorReview') return mockReviewRepository;
            if (entity.name === 'Appointment') return mockAppointmentRepository;
            if (entity.name === 'Doctor') return mockDoctorRepository;
            return {};
        });

        reviewService = new ReviewService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createReview', () => {
        const createDto: CreateReviewDto = {
            appointment_id: 1,
            rating: 5,
            review_text: 'Excellent doctor!',
        };

        it('should create a review successfully', async () => {
            const appointment = {
                id: 1,
                patient_id: 1,
                doctor_id: 2,
                status: AppointmentStatus.COMPLETED,
            };
            mockAppointmentRepository.findOne.mockResolvedValue(appointment);
            mockReviewRepository.findOne.mockResolvedValue(null);
            const savedReview = { ...createDto, id: 1, patient_id: 1, doctor_id: 2 };
            mockReviewRepository.create.mockReturnValue(savedReview);
            mockReviewRepository.save.mockResolvedValue(savedReview);
            mockReviewRepository.find.mockResolvedValue([savedReview]);

            const result = await reviewService.createReview(1, createDto);

            expect(mockAppointmentRepository.findOne).toHaveBeenCalled();
            expect(mockReviewRepository.create).toHaveBeenCalled();
            expect(mockReviewRepository.save).toHaveBeenCalled();
            expect(mockDoctorRepository.update).toHaveBeenCalled();
            expect(result).toEqual(savedReview);
        });

        it('should throw error if appointment not found', async () => {
            mockAppointmentRepository.findOne.mockResolvedValue(null);

            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(AppError);
            await expect(reviewService.createReview(1, createDto)).rejects.toThrow('Appointment not found');
        });

        it('should throw error if appointment does not belong to patient', async () => {
            const appointment = {
                id: 1,
                patient_id: 2,
                doctor_id: 3,
                status: AppointmentStatus.COMPLETED,
            };
            mockAppointmentRepository.findOne.mockResolvedValue(appointment);

            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(AppError);
            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(
                'Unauthorized to review this appointment',
            );
        });

        it('should throw error if appointment is not completed', async () => {
            const appointment = {
                id: 1,
                patient_id: 1,
                doctor_id: 2,
                status: AppointmentStatus.SCHEDULED,
            };
            mockAppointmentRepository.findOne.mockResolvedValue(appointment);

            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(AppError);
            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(
                'Can only review completed appointments',
            );
        });

        it('should throw error if review already exists', async () => {
            const appointment = {
                id: 1,
                patient_id: 1,
                doctor_id: 2,
                status: AppointmentStatus.COMPLETED,
            };
            const existingReview = { id: 1, appointment_id: 1 };
            mockAppointmentRepository.findOne.mockResolvedValue(appointment);
            mockReviewRepository.findOne.mockResolvedValue(existingReview);

            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(AppError);
            await expect(reviewService.createReview(1, createDto)).rejects.toThrow(
                'Review already exists for this appointment',
            );
        });
    });

    describe('updateReview', () => {
        const updateDto: UpdateReviewDto = {
            rating: 4,
            review_text: 'Updated review',
        };

        it('should update review successfully', async () => {
            const review = {
                id: 1,
                patient_id: 1,
                doctor_id: 2,
                rating: 5,
            };
            mockReviewRepository.findOne.mockResolvedValue(review);
            mockReviewRepository.save.mockResolvedValue({ ...review, ...updateDto });
            mockReviewRepository.find.mockResolvedValue([{ ...review, ...updateDto }]);

            const result = await reviewService.updateReview(1, 1, updateDto);

            expect(mockReviewRepository.findOne).toHaveBeenCalled();
            expect(mockReviewRepository.save).toHaveBeenCalled();
            expect(mockDoctorRepository.update).toHaveBeenCalled();
            expect(result.rating).toBe(updateDto.rating);
        });

        it('should throw error if review not found', async () => {
            mockReviewRepository.findOne.mockResolvedValue(null);

            await expect(reviewService.updateReview(999, 1, updateDto)).rejects.toThrow(AppError);
            await expect(reviewService.updateReview(999, 1, updateDto)).rejects.toThrow('Review not found');
        });

        it('should throw error if unauthorized', async () => {
            const review = {
                id: 1,
                patient_id: 2,
                doctor_id: 3,
            };
            mockReviewRepository.findOne.mockResolvedValue(review);

            await expect(reviewService.updateReview(1, 1, updateDto)).rejects.toThrow(AppError);
            await expect(reviewService.updateReview(1, 1, updateDto)).rejects.toThrow(
                'Unauthorized to update this review',
            );
        });
    });

    describe('deleteReview', () => {
        it('should delete review successfully', async () => {
            const review = {
                id: 1,
                patient_id: 1,
                doctor_id: 2,
            };
            mockReviewRepository.findOne.mockResolvedValue(review);
            mockReviewRepository.remove.mockResolvedValue(review);
            mockReviewRepository.find.mockResolvedValue([]);

            await reviewService.deleteReview(1, 1);

            expect(mockReviewRepository.findOne).toHaveBeenCalled();
            expect(mockReviewRepository.remove).toHaveBeenCalled();
            expect(mockDoctorRepository.update).toHaveBeenCalled();
        });

        it('should throw error if review not found', async () => {
            mockReviewRepository.findOne.mockResolvedValue(null);

            await expect(reviewService.deleteReview(999, 1)).rejects.toThrow(AppError);
            await expect(reviewService.deleteReview(999, 1)).rejects.toThrow('Review not found');
        });
    });

    describe('getFeaturedReviews', () => {
        it('should return featured reviews', async () => {
            const reviews = [
                { id: 1, is_featured: true, rating: 5 },
                { id: 2, is_featured: true, rating: 5 },
            ];
            mockReviewRepository.find.mockResolvedValue(reviews);

            const result = await reviewService.getFeaturedReviews(10);

            expect(mockReviewRepository.find).toHaveBeenCalledWith({
                where: { is_featured: true },
                relations: ['patient', 'doctor', 'doctor.user'],
                order: { created_at: 'DESC' },
                take: 10,
            });
            expect(result).toEqual(reviews);
        });
    });
});
