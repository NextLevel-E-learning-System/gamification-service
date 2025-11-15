import { withClient } from '../db.js';

type UserBadge = {
  codigo: string;
  nome: string;
  descricao?: string;
  criterio?: string;
  icone_url?: string;
  pontos_necessarios?: number;
  criado_em?: Date;
};

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT b.codigo, b.nome, b.descricao, b.criterio, b.icone_url, 
              b.pontos_necessarios, fb.data_conquista as criado_em
       FROM gamification_service.funcionario_badges fb
       JOIN gamification_service.badges b ON b.codigo = fb.badge_id
       WHERE fb.funcionario_id = $1
       ORDER BY fb.data_conquista DESC`,
      [userId]
    );
    return result.rows;
  });
}
