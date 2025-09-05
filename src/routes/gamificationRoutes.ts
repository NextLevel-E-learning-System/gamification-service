import { Router } from 'express';
import { createBadgeHandler, getBadgeHandler } from '../controllers/badgeController.js';
import { getPerfilHandler, getRankingDepartamentoHandler, getRankingGlobalHandler } from '../controllers/perfilController.js';
export const gamificationRouter = Router();
gamificationRouter.post('/badges', createBadgeHandler);
gamificationRouter.get('/badges/:codigo', getBadgeHandler);
gamificationRouter.get('/me', getPerfilHandler);
gamificationRouter.get('/ranking/global', getRankingGlobalHandler);
gamificationRouter.get('/ranking/departamento', getRankingDepartamentoHandler);
