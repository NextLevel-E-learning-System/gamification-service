import { Request, Response, NextFunction } from 'express'
import { rankingMensal } from '../services/rankingService.js'

export async function getMonthlyRankingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const departamento = req.query.departamento as string | undefined
    const data = await rankingMensal(departamento)
    res.json(data)
  } catch (e) {
    next(e)
  }
}
