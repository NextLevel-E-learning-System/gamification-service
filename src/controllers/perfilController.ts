import { Request, Response, NextFunction } from 'express';
import { getOrCreatePerfil, getRankingDepartamento, getRankingGlobal } from '../services/perfilService.js';

export async function getPerfilHandler(req:Request,res:Response,next:NextFunction){
  try {
    const userId = req.header('X-User-Id');
    if(!userId) return res.status(400).json({ error: 'missing_user_header' });
    const perfil = await getOrCreatePerfil(userId);
    res.json(perfil);
  } catch(e){ next(e);} }

export async function getRankingGlobalHandler(_req:Request,res:Response,next:NextFunction){
  try { const ranking = await getRankingGlobal(); res.json(ranking);} catch(e){ next(e);} }

export async function getRankingDepartamentoHandler(req:Request,res:Response,next:NextFunction){
  try { const dep = req.header('X-Departamento-Id'); if(!dep) return res.status(400).json({ error:'missing_department_header'}); const ranking = await getRankingDepartamento(dep); res.json(ranking);} catch(e){ next(e);} }
