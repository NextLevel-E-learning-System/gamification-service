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
    await ensureTables(c);
    const perfil = await c.query('select user_id, xp from perfis where user_id=$1',[userId]);
    if(perfil.rowCount===0){ await c.query('insert into perfis(user_id,xp) values($1,0)',[userId]); }
    const { rows } = await c.query('select user_id, xp from perfis where user_id=$1',[userId]);
    const xp = rows[0].xp as number;
    const { nivel, proximoNivelXp } = nivelFromXp(xp);
    const badgesRes = await c.query('select b.codigo, b.nome from user_badges ub join badges b on b.codigo=ub.badge_codigo where ub.user_id=$1',[userId]);
    return { userId, xp, nivel, proximoNivelXp, badges: badgesRes.rows };
  });
}

export async function adjustXp(userId:string, delta:number, sourceEventId:string){
  let newTotal = 0;
  await withClient(async c => {
    await ensureTables(c);
    // Idempotência simples: evitar duplicar delta para mesmo source_event_id
    const exists = await c.query('select 1 from xp_events where source_event_id=$1 limit 1',[sourceEventId]);
  if((exists.rowCount ?? 0) > 0) return; // já aplicado
    await c.query('insert into xp_events(event_id,user_id,delta,source_event_id) values(gen_random_uuid(),$1,$2,$3)',[userId, delta, sourceEventId]);
    await c.query('insert into perfis(user_id,xp) values($1,$2) on conflict (user_id) do update set xp=perfis.xp + excluded.xp',[userId, delta]);
    const r = await c.query('select xp from perfis where user_id=$1',[userId]);
    newTotal = r.rows[0].xp;
  });
  if(newTotal){
    const { nivel } = nivelFromXp(newTotal);
    const payload: XpAdjustedPayload = { userId, delta, newTotalXp: newTotal, level: nivel, sourceEventId };
    await publishEvent<XpAdjustedPayload>({ type:'xp.adjusted.v1', payload });
  }
}

export async function getRankingGlobal(){
  return withClient(async c => { await ensureTables(c); const { rows } = await c.query('select user_id, xp from perfis order by xp desc limit 50'); return rows; });
}

export async function getRankingDepartamento(_departamentoId:string){
  // Placeholder: sem relação real departamento <-> user, retornando global temporariamente
  return getRankingGlobal();
}

import type { PoolClient } from 'pg';
async function ensureTables(c:PoolClient){
  await c.query(`create table if not exists perfis (
    user_id uuid primary key,
    xp int not null default 0
  )`);
  await c.query(`create table if not exists xp_events (
    event_id uuid primary key,
    user_id uuid not null,
    delta int not null,
    source_event_id uuid not null,
    created_at timestamptz not null default now()
  )`);
  await c.query(`create table if not exists events_store (
    event_id uuid primary key,
    type text not null,
    occurred_at timestamptz not null,
    payload jsonb not null
  )`);
  await c.query(`create table if not exists user_badges (
    user_id uuid not null,
    badge_codigo text not null,
    earned_at timestamptz not null default now(),
    primary key(user_id,badge_codigo)
  )`);
  await c.query(`create table if not exists badges (
    codigo text primary key,
    nome text not null,
    descricao text,
    criterio text,
    icone_url text,
    pontos_necessarios int not null default 0
  )`);
}
