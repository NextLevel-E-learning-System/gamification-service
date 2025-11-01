import { Request, Response, NextFunction } from 'express';
import { rankingMensal, xpHistory } from '../services/rankingService.js';

export async function getMonthlyRankingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const mes = req.query.mes as string | undefined;
    const departamento = req.query.departamento as string | undefined;
    const data = await rankingMensal(mes, departamento);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function getXpHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const limitParam = req.query.limit as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(limitParam ? Number(limitParam) : 50, 100);
    const data = await xpHistory(id, limit, cursor);
    res.json({
      items: data,
      nextCursor: data.length === limit ? data[data.length - 1].id : null,
    });
  } catch (e) {
    next(e);
  }
}
