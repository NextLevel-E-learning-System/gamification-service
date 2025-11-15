import { Request, Response, NextFunction } from 'express';
import { rankingMensal } from '../services/rankingService.js';

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
