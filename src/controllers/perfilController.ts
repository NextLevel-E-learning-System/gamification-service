import { Request, Response, NextFunction } from 'express';
import { getUserBadges } from '../repositories/badgeRepository.js';
import { getRankingGlobal } from '../services/perfilService.js';

export async function getPerfilHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.header('X-User-Id');
    if (!userId) return res.status(400).json({ error: 'missing_user_header' });
    
    // Retorna apenas badges - XP e nível vêm do user-service
    const badges = await getUserBadges(userId);
    res.json({ badges });
  } catch (e) {
    next(e);
  }
}

export async function getRankingGlobalHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const ranking = await getRankingGlobal();
    res.json(ranking);
  } catch (e) {
    next(e);
  }
}

