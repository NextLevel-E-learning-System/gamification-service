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
import { withClient } from '../db.js';
import { avaliarTodosBadges } from './badgeEvaluator.js';
import { logger } from '../config/logger.js';

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

// REAVALIAR BADGES DO USUÁRIO (verifica todos os critérios novamente)
export async function reavaliarBadgesUsuario(userId: string) {
  return withClient(async (client) => {
    const results = await avaliarTodosBadges(client, userId, `manual_reeval:${Date.now()}`);

    const conquistados = results.filter((r) => r.awarded);
    const jaConquistados = results.filter((r) => r.alreadyOwned);
    const naoAtendidos = results.filter((r) => !r.awarded && !r.alreadyOwned);

    logger.info(
      {
        userId,
        novosConquistados: conquistados.length,
        jaConquistados: jaConquistados.length,
        naoAtendidos: naoAtendidos.length,
      },
      'badges_reevaluated'
    );

    return {
      success: true,
      message: 'Badges reavaliados com sucesso',
      conquistados: conquistados.map((b) => b.badgeCode),
      jaConquistados: jaConquistados.map((b) => b.badgeCode),
      naoAtendidos: naoAtendidos.length,
      details: results,
    };
  });
}
