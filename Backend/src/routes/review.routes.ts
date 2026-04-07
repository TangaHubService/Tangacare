import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { validateDto } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { CreateReviewDto, UpdateReviewDto } from '../dto/review.dto';

const router = Router();
const reviewController = new ReviewController();

router.post('/', authenticate, validateDto(CreateReviewDto), reviewController.createReview);

router.get('/doctor/:doctorId', reviewController.getReviewsByDoctor);

router.get('/featured', reviewController.getFeaturedReviews);

router.put('/:id', authenticate, validateDto(UpdateReviewDto), reviewController.updateReview);

router.delete('/:id', authenticate, reviewController.deleteReview);

export default router;
