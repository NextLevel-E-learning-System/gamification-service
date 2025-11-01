import { withClient } from '../db.js';
import { publishEvent } from '../events/publisher.js';
import { XpAdjustedPayload } from '../events/contracts.js';

export interface PerfilGamification {
  userId: string;
  xp: number;
  nivel: string;
  proximoNivelXp: number;
  badges: Array<{ codigo:string; nome:string }>;
}

function nivelFromXp(xp:number){
  // Faixas definidas: Iniciante: 0-999, Intermediário: 1000-2999, Avançado: 3000+
  let label = 'Iniciante';
  if(xp >= 3000) label = 'Avançado'; else if(xp >= 1000) label = 'Intermediário';
  // Próximo nível XP
  let proximoNivelXp = 1000; if(xp >= 1000 && xp < 3000) proximoNivelXp = 3000; else if(xp >=3000) proximoNivelXp = xp; // sem próximo definido
  return { nivelLabel: label, proximoNivelXp };
}

export async function getOrCreatePerfil(userId:string): Promise<PerfilGamification>{
  return withClient(async c => {
    // Usa tabela existente user_service.funcionarios
    const func = await c.query('select id as user_id, xp_total from user_service.funcionarios where id=$1',[userId]);
    if(func.rowCount===0){
      // Em vez de criar, retorna erro explícito
      throw new Error('usuario_nao_encontrado');
    }
    const xp = Number(func.rows[0].xp_total)||0;
  const { nivelLabel, proximoNivelXp } = nivelFromXp(xp);
    const badgesRes = await c.query(`select b.codigo, b.nome
      from gamification_service.funcionario_badges fb
      join gamification_service.badges b on b.codigo=fb.badge_id
      where fb.funcionario_id=$1`,[userId]);
  return { userId, xp, nivel: nivelLabel, proximoNivelXp, badges: badgesRes.rows };
  });
}

export async function adjustXp(userId: string, delta: number, sourceEventId: string, motivo?: string) {
  if (delta === 0) return; // ignorar neutros
  let newTotal = 0;
  await withClient(async (c) => {
    // Idempotência via historico_xp.referencia_id
    const exists = await c.query(
      'SELECT 1 FROM gamification_service.historico_xp WHERE referencia_id = $1 LIMIT 1',
      [sourceEventId]
    );
    if ((exists.rowCount ?? 0) > 0) return;

    await c.query(
      `INSERT INTO gamification_service.historico_xp 
       (funcionario_id, xp_ganho, motivo, referencia_id) 
       VALUES ($1, $2, $3, $4)`,
      [userId, delta, motivo || 'event', sourceEventId]
    );

    const upd = await c.query(
      `UPDATE user_service.funcionarios 
       SET xp_total = COALESCE(xp_total, 0) + $2 
       WHERE id = $1 
       RETURNING xp_total`,
      [userId, delta]
    );
    if ((upd.rowCount ?? 0) > 0) newTotal = Number(upd.rows[0].xp_total) || 0;
  });

  if (newTotal) {
    const { nivelLabel } = nivelFromXp(newTotal);
    // Atualiza coluna nivel se mudou
    await withClient(async (c) => {
      await c.query(
        'UPDATE user_service.funcionarios SET nivel = $2 WHERE id = $1 AND nivel <> $2',
        [userId, nivelLabel]
      );
    });
    const payload: XpAdjustedPayload = {
      userId,
      delta,
      newTotalXp: newTotal,
      level: nivelLabel,
      sourceEventId,
    };
    await publishEvent<XpAdjustedPayload>({ type: 'xp.adjusted.v1', payload });
  }
}

export async function getRankingGlobal(){
  return withClient(async c => { const { rows } = await c.query('select id as user_id, xp_total as xp from user_service.funcionarios order by xp_total desc nulls last limit 50'); return rows; });
}

export async function getRankingDepartamento(_departamentoId:string){
  // Placeholder: sem relação real departamento <-> user, retornando global temporariamente
  return getRankingGlobal();
}
 