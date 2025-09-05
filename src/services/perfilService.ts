import { withClient } from '../db.js';
import { publishEvent } from '../events/publisher.js';
import { XpAdjustedPayload } from '../events/contracts.js';

export interface PerfilGamification {
  userId: string;
  xp: number;
  nivel: number;
  proximoNivelXp: number;
  badges: Array<{ codigo:string; nome:string }>;
}

function nivelFromXp(xp:number){
  // Exemplo simples: cada nível exige 100 * n XP cumulativo (triangular * 50) => ajustável
  let nivel = 1; let threshold = 100; let acumulado=0; while(xp >= threshold){ nivel++; acumulado += threshold; threshold = 100 * nivel; }
  return { nivel, proximoNivelXp: acumulado + threshold };
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
    const { nivel, proximoNivelXp } = nivelFromXp(xp);
    const badgesRes = await c.query(`select b.codigo, b.nome
      from gamification_service.funcionario_badges fb
      join gamification_service.badges b on b.codigo=fb.badge_id
      where fb.funcionario_id=$1`,[userId]);
    return { userId, xp, nivel, proximoNivelXp, badges: badgesRes.rows };
  });
}

export async function adjustXp(userId:string, delta:number, sourceEventId:string){
  if(delta === 0) return; // ignorar neutros aqui (já contabilizado em módulo final)
  let newTotal = 0;
  await withClient(async c => {
    // Idempotência via historico_xp.referencia_id
    const exists = await c.query('select 1 from gamification_service.historico_xp where referencia_id=$1 limit 1',[sourceEventId]);
    if((exists.rowCount ?? 0) > 0) return;
    await c.query('insert into gamification_service.historico_xp(id, funcionario_id, xp_ganho, motivo, referencia_id) values(gen_random_uuid(), $1, $2, $3, $4)',[userId, delta, 'event', sourceEventId]);
    const upd = await c.query('update user_service.funcionarios set xp_total = coalesce(xp_total,0) + $2 where id=$1 returning xp_total',[userId, delta]);
  if((upd.rowCount ?? 0) > 0) newTotal = Number(upd.rows[0].xp_total)||0;
  });
  if(newTotal){
    const { nivel } = nivelFromXp(newTotal);
    const payload: XpAdjustedPayload = { userId, delta, newTotalXp: newTotal, level: nivel, sourceEventId };
    await publishEvent<XpAdjustedPayload>({ type:'xp.adjusted.v1', payload });
  }
}

export async function getRankingGlobal(){
  return withClient(async c => { const { rows } = await c.query('select id as user_id, xp_total as xp from user_service.funcionarios order by xp_total desc nulls last limit 50'); return rows; });
}

export async function getRankingDepartamento(_departamentoId:string){
  // Placeholder: sem relação real departamento <-> user, retornando global temporariamente
  return getRankingGlobal();
}
 