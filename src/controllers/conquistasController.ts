import { Request, Response, NextFunction } from 'express';
import { listarConquistas } from '../services/conquistasService.js';

export async function getConquistasHandler(req:Request,res:Response,next:NextFunction){
  try {
    const userId = req.header('X-User-Id');
    if(!userId) return res.status(400).json({ error: 'missing_user_header' });
    const data = await listarConquistas(userId);
    res.json(data);
  } catch(e){ next(e);} }
