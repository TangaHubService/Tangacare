import { Router } from 'express';
import { PublicProcurementController } from '../controllers/pharmacy/public-procurement.controller';

const router = Router();
const controller = new PublicProcurementController();

router.get('/po/:token', controller.getOrderByToken);
router.post('/po/:token/action', controller.supplierAction);

export default router;
