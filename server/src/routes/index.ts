import { Router } from 'express';
import componentsRouter from './components';
import bomRouter from './bom';
import dashboardRouter from './dashboard';

const router = Router();

router.use('/components', componentsRouter);
router.use('/bom', bomRouter);
router.use('/dashboard', dashboardRouter);

export default router;