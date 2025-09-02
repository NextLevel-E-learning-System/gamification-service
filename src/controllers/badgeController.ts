import { Request, Response, NextFunction } from 'express';
import { createBadgeSchema } from '../validation/gamificationSchemas.js';
import { createBadge, getBadge } from '../services/badgeService.js';
import { HttpError } from '../utils/httpError.js';
export async function createBadgeHandler(req:Request,res:Response,next:NextFunction){ const parsed=createBadgeSchema.safeParse(req.body); if(!parsed.success) return next(new HttpError(400,'validation_error',parsed.error.issues)); try { const r= await createBadge(parsed.data); res.status(201).json(r);} catch(e){ next(e);} }
export async function getBadgeHandler(req:Request,res:Response,next:NextFunction){ try { const r= await getBadge(req.params.codigo); res.json(r);} catch(e){ next(e);} }
