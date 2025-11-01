import { withClient } from '../db.js';

export interface RankingEntry {
  id: number;
  funcionario_id: string;
  nome: string;
  xp_total: number;
  xp_mes: number;
  posicao_geral: number | null;
  posicao_mensal: number | null;
  departamento_id: string | null;
  atualizado_em: Date;
}

/**
 * Busca entrada do ranking por funcionário ID
 */
export async function getRankingByFuncionarioId(funcionarioId: string): Promise<RankingEntry | null> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT * FROM gamification_service.ranking WHERE funcionario_id = $1`,
      [funcionarioId]
    );
    return result.rows[0] || null;
  });
}

/**
 * Atualiza o ranking completo (chama a função SQL)
 */
export async function atualizarRanking(): Promise<void> {
  return withClient(async (c) => {
    await c.query('SELECT gamification_service.atualizar_ranking()');
  });
}

/**
 * Busca top N do ranking geral
 */
export async function getTopRankingGeral(limit = 50): Promise<RankingEntry[]> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT * FROM gamification_service.ranking 
       ORDER BY posicao_geral ASC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  });
}

/**
 * Busca top N do ranking mensal
 */
export async function getTopRankingMensal(limit = 50): Promise<RankingEntry[]> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT * FROM gamification_service.ranking 
       ORDER BY posicao_mensal ASC 
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  });
}

/**
 * Busca ranking de um departamento específico
 */
export async function getRankingByDepartamento(
  departamentoId: string,
  limit = 50
): Promise<RankingEntry[]> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT * FROM gamification_service.ranking 
       WHERE departamento_id = $1
       ORDER BY posicao_geral ASC 
       LIMIT $2`,
      [departamentoId, limit]
    );
    return result.rows;
  });
}
