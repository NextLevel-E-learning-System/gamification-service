import { withClient } from '../db.js';
import { getOrCreatePerfil } from './perfilService.js';

export interface ConquistasResponse {
  userId: string;
  xp: number;
  nivel: string;
  proximoNivelXp: number;
  badges: Array<{ codigo: string; nome: string }>;
  historicoXp: Array<{ id: string; xp_ganho: number; motivo: string; referencia_id: string | null; }>;
}

export async function listarConquistas(userId: string): Promise<ConquistasResponse> {
  const perfil = await getOrCreatePerfil(userId);
  const historicoXp = await withClient(async c => {
    const r = await c.query(`select id, xp_ganho, motivo, referencia_id
                              from gamification_service.historico_xp
                              where funcionario_id=$1
                              order by id desc
                              limit 50`, [userId]);
    return r.rows.map(row => ({
      id: row.id,
      xp_ganho: Number(row.xp_ganho) || 0,
      motivo: row.motivo,
      referencia_id: row.referencia_id ?? null
    }));
  });
  return { ...perfil, historicoXp };
}
