import { Request, Response, NextFunction } from 'express';
import { createBadgeSchema, updateBadgeSchema } from '../validation/gamificationSchemas.js';
import {
  createBadge,
  getBadge,
  listBadges,
  updateBadge,
  deleteBadge,
  getUserBadgesList,
  reavaliarBadgesUsuario,
} from '../services/badgeService.js';
import { HttpError } from '../utils/httpError.js';

// CREATE
export async function createBadgeHandler(req: Request, res: Response, next: NextFunction) {
  const parsed = createBadgeSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new HttpError(400, 'validation_error', parsed.error.issues));
  }
  try {
    const badge = await createBadge(parsed.data);
    res.status(201).json(badge);
  } catch (e) {
    next(e);
  }
}

// READ - Single
export async function getBadgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const badge = await getBadge(req.params.codigo);
    res.json(badge);
  } catch (e) {
    next(e);
  }
}

// READ - List
export async function listBadgesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const badges = await listBadges();
    res.json(badges);
  } catch (e) {
    next(e);
  }
}

// UPDATE
export async function updateBadgeHandler(req: Request, res: Response, next: NextFunction) {
  const parsed = updateBadgeSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new HttpError(400, 'validation_error', parsed.error.issues));
  }
  try {
    const badge = await updateBadge(req.params.codigo, parsed.data);
    res.json(badge);
  } catch (e) {
    next(e);
  }
}

// DELETE
export async function deleteBadgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteBadge(req.params.codigo);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

// GET USER BADGES
export async function getUserBadgesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.params.userId || req.params.id;
    const badges = await getUserBadgesList(userId);
    res.json(badges);
  } catch (e) {
    next(e);
  }
}

// REAVALIAR BADGES DO USUÁRIO
export async function reavaliarBadgesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = req.params;
    const result = await reavaliarBadgesUsuario(userId);
    res.json(result);
  } catch (e) {
    next(e);
  }
}
