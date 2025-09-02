import { Router } from 'express';
import { createBadgeHandler, getBadgeHandler } from '../controllers/badgeController.js';
export const gamificationRouter = Router();
gamificationRouter.post('/badges', createBadgeHandler);
gamificationRouter.get('/badges/:codigo', getBadgeHandler);
