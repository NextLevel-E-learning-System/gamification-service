import { Request, Response, NextFunction } from 'express';
import { listarConquistas } from '../services/conquistasService.js';
import { reprocessarBadges } from '../services/autoBadgesService.js';

export async function getConquistasHandler(req:Request,res:Response,next:NextFunction){
  try {
    const userId = req.header('X-User-Id');
    if(!userId) return res.status(400).json({ error: 'missing_user_header' });
    const data = await listarConquistas(userId);
    res.json(data);
  } catch(e){ next(e);} }

export async function reprocessBadgesHandler(req:Request,res:Response,next:NextFunction){
  try {
    const userId = req.header('X-User-Id') || undefined;
    const result = await reprocessarBadges(userId);
    res.status(202).json({ status:'accepted', ...result });
  } catch(e){ next(e);} }
