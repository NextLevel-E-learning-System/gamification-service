import {
  insertBadge,
  findBadge,
  listBadges as listBadgesRepo,
  updateBadge as updateBadgeRepo,
  deleteBadge as deleteBadgeRepo,
  getUserBadges,
  type NewBadge,
  type UpdateBadge,
} from '../repositories/badgeRepository.js';
import { HttpError } from '../utils/httpError.js';

// CREATE
export async function createBadge(data: NewBadge) {
  try {
    const badge = await insertBadge(data);
    return badge;
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      throw new HttpError(409, 'badge_ja_existe', 'Já existe um badge com este código');
    }
    throw err;
  }
}

// READ
export async function getBadge(codigo: string) {
  const badge = await findBadge(codigo);
  if (!badge) {
    throw new HttpError(404, 'badge_nao_encontrado', 'Badge não encontrado');
  }
  return badge;
}

export async function listBadges() {
  return listBadgesRepo();
}

// UPDATE
export async function updateBadge(codigo: string, data: UpdateBadge) {
  const exists = await findBadge(codigo);
  if (!exists) {
    throw new HttpError(404, 'badge_nao_encontrado', 'Badge não encontrado');
  }

  const updated = await updateBadgeRepo(codigo, data);
  return updated;
}

// DELETE
export async function deleteBadge(codigo: string) {
  const exists = await findBadge(codigo);
  if (!exists) {
    throw new HttpError(404, 'badge_nao_encontrado', 'Badge não encontrado');
  }

  await deleteBadgeRepo(codigo);
  return { message: 'Badge excluído com sucesso' };
}

// GET USER BADGES
export async function getUserBadgesList(userId: string) {
  return getUserBadges(userId);
}

