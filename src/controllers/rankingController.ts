import { Request, Response, NextFunction } from 'express';
import { rankingMensal, xpHistory } from '../services/rankingService.js';
import { withClient } from '../db.js';

export async function getMonthlyRankingHandler(req:Request,res:Response,next:NextFunction){
  try { const mes = req.query.mes as string|undefined; const departamento = req.query.departamento as string|undefined; const data = await rankingMensal(mes, departamento); res.json(data); } catch(e){ next(e);} }
export async function getUserBadgesHandler(req:Request,res:Response,next:NextFunction){
  try { const { id } = req.params; const r = await withClient(c=> c.query(`select b.codigo,b.nome,b.descricao from gamification_service.funcionario_badges fb join gamification_service.badges b on b.codigo=fb.badge_id where fb.funcionario_id=$1 order by b.codigo`,[id])); res.json(r.rows); } catch(e){ next(e);} }
export async function getXpHistoryHandler(req:Request,res:Response,next:NextFunction){
  try { const { id } = req.params; const limitParam = req.query.limit as string|undefined; const cursor = req.query.cursor as string|undefined; const lim = Math.min(limitParam ? Number(limitParam):50,100); const data = await xpHistory(id, lim, cursor); res.json({ items:data, nextCursor: data.length===lim ? data[data.length-1].id : null }); } catch(e){ next(e);} }
export async function listBadgesHandler(_req:Request,res:Response,next:NextFunction){
  try { const r = await withClient(c=> c.query('select codigo,nome,descricao,criterio,icone_url,pontos_necessarios from gamification_service.badges order by codigo')); res.json(r.rows); } catch(e){ next(e);} }