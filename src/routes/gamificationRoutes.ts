import { Router } from 'express';
import {
  createBadgeHandler,
  getBadgeHandler,
  listBadgesHandler,
  updateBadgeHandler,
  deleteBadgeHandler,
  getUserBadgesHandler,
  reavaliarBadgesHandler,
} from '../controllers/badgeController.js';
import { getPerfilHandler, getRankingDepartamentoHandler, getRankingGlobalHandler } from '../controllers/perfilController.js';
import { getConquistasHandler } from '../controllers/conquistasController.js';
import { getMonthlyRankingHandler, getXpHistoryHandler } from '../controllers/rankingController.js';

export const gamificationRouter = Router();

// ========== BADGES - CRUD (Admin/Gerente) ==========
gamificationRouter.post('/badges', createBadgeHandler); // CREATE
gamificationRouter.get('/badges', listBadgesHandler); // READ ALL
gamificationRouter.get('/badges/:codigo', getBadgeHandler); // READ ONE
gamificationRouter.put('/badges/:codigo', updateBadgeHandler); // UPDATE
gamificationRouter.patch('/badges/:codigo', updateBadgeHandler); // UPDATE (parcial)
gamificationRouter.delete('/badges/:codigo', deleteBadgeHandler); // DELETE

// ========== PERFIL DO USUÁRIO ==========
gamificationRouter.get('/me', getPerfilHandler); // Meu perfil (XP, nível, badges)

// ========== RANKINGS ==========
gamificationRouter.get('/ranking/global', getRankingGlobalHandler); // Top 50 global
gamificationRouter.get('/ranking/departamento', getRankingDepartamentoHandler); // Ranking por departamento
gamificationRouter.get('/ranking/monthly', getMonthlyRankingHandler); // Ranking mensal

// ========== CONQUISTAS/BADGES DE USUÁRIOS ==========
gamificationRouter.get('/users/:id/badges', getUserBadgesHandler); // Badges de um usuário
gamificationRouter.get('/users/:id/xp-history', getXpHistoryHandler); // Histórico de XP
gamificationRouter.get('/conquistas', getConquistasHandler); // Minhas conquistas

// ========== ADMIN - Gerenciamento de Badges ==========
gamificationRouter.post('/users/:userId/badges/reavaliar', reavaliarBadgesHandler); // Reavaliar todos os badges do usuário
