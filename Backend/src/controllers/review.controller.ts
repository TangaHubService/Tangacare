import { Request, Response } from 'express';
import { ReviewService } from '../services/review.service';
import { ResponseUtil } from '../utils/response.util';
import { AuthRequest } from '../middleware/auth.middleware';

export class ReviewController {
    private reviewService: ReviewService;

    constructor() {
        this.reviewService = new ReviewService();
    }

    createReview = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const review = await this.reviewService.createReview(req.user!.userId, req.body);
            ResponseUtil.created(res, review, 'Review created successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to create review', error.message);
            }
        }
    };

    getReviewsByDoctor = async (req: Request, res: Response): Promise<void> => {
        try {
            const doctorId = parseInt(req.params.doctorId);
            const reviews = await this.reviewService.getReviewsByDoctor(doctorId);
            ResponseUtil.success(res, reviews, 'Reviews retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve reviews', error.message);
            }
        }
    };

    getFeaturedReviews = async (req: Request, res: Response): Promise<void> => {
        try {
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
            const reviews = await this.reviewService.getFeaturedReviews(limit);
            ResponseUtil.success(res, reviews, 'Featured reviews retrieved successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to retrieve featured reviews', error.message);
            }
        }
    };

    updateReview = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const reviewId = parseInt(req.params.id);
            const review = await this.reviewService.updateReview(reviewId, req.user!.userId, req.body);
            ResponseUtil.success(res, review, 'Review updated successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to update review', error.message);
            }
        }
    };

    deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const reviewId = parseInt(req.params.id);
            await this.reviewService.deleteReview(reviewId, req.user!.userId);
            ResponseUtil.success(res, null, 'Review deleted successfully');
        } catch (error: any) {
            if (error.statusCode) {
                ResponseUtil.error(res, error.message, error.statusCode);
            } else {
                ResponseUtil.internalError(res, 'Failed to delete review', error.message);
            }
        }
    };
}
