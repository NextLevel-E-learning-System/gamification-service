import { Router } from 'express';
import { getPerfilHandler, getRankingGlobalHandler } from '../controllers/perfilController.js';
import { getMonthlyRankingHandler } from '../controllers/rankingController.js';

export const gamificationRouter = Router();

// ========== PERFIL DO USUÁRIO ==========
gamificationRouter.get('/me', getPerfilHandler); // Meu perfil (XP, nível, badges)

// ========== RANKINGS ==========
gamificationRouter.get('/ranking/global', getRankingGlobalHandler); // Top 50 global
gamificationRouter.get('/ranking/monthly', getMonthlyRankingHandler); // Ranking mensal
