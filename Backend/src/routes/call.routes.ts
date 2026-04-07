import { Router } from 'express';
import { CallController } from '../controllers/call.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const callController = new CallController();

router.use(authenticate);

router.get('/', callController.getCallHistory);

router.get('/:id', callController.getCallDetails);

export default router;
