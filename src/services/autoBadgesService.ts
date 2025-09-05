import { withClient } from '../db.js';
import type { PoolClient } from 'pg';

async function atribuirBadge(c:PoolClient, userId:string, codigo:string){
  await c.query(`insert into gamification_service.badges(codigo,nome,descricao) values($1,$1,$1) on conflict (codigo) do nothing`,[codigo]);
  const has = await c.query('select 1 from gamification_service.funcionario_badges where funcionario_id=$1 and badge_id=$2',[userId, codigo]);
  if((has.rowCount ?? 0) > 0) return false;
  await c.query('insert into gamification_service.funcionario_badges(funcionario_id,badge_id) values($1,$2)',[userId,codigo]);
  await c.query('insert into gamification_service.historico_xp(id, funcionario_id, xp_ganho, motivo, referencia_id) values (gen_random_uuid(), $1, 0, $2, $3)',[userId, `badge:${codigo}`, 'manual-reprocess']);
  return true;
}

async function avaliarBadgesUsuario(c:PoolClient, userId:string){
  // PRIMEIRO_CURSO
  const concl = await c.query(`select count(*)::int as total from progress_service.inscricoes where funcionario_id=$1 and status='CONCLUIDO'`,[userId]);
  const total = concl.rows[0]?.total as number ?? 0;
  if(total===1){ await atribuirBadge(c,userId,'PRIMEIRO_CURSO'); }
  // MARATONISTA
  const maratona = await c.query(`select count(*)::int as cnt from progress_service.inscricoes 
    where funcionario_id=$1 and status='CONCLUIDO' and date_trunc('month', data_conclusao)=date_trunc('month', now())`,[userId]);
  if((maratona.rows[0]?.cnt as number) === 5){ await atribuirBadge(c,userId,'MARATONISTA'); }
  // EXPERT (>=3000 XP)
  const xpRes = await c.query('select xp_total from user_service.funcionarios where id=$1',[userId]);
  const xp = Number(xpRes.rows[0]?.xp_total) || 0;
  if(xp >= 3000){ await atribuirBadge(c,userId,'EXPERT'); }
}

export async function reprocessarBadges(userId?:string){
  if(userId){
    await withClient(async c => { await avaliarBadgesUsuario(c,userId); });
    return { processed: 1 };
  }
  // Reprocessa para todos (limite defensivo)
  let count = 0;
  await withClient(async c => {
    const users = await c.query('select id from user_service.funcionarios limit 1000');
    for(const u of users.rows){
      await avaliarBadgesUsuario(c, u.id);
      count++;
    }
  });
  return { processed: count };
}
