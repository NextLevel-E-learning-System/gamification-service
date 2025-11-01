import { withClient } from '../db.js';

export async function rankingMensal(mes?:string, departamentoId?:string){
  // mes formato YYYY-MM; se omitido usa mês atual
  return withClient(async c => {
    const monthExpr = mes ? `${mes}-01` : undefined;
    const params:unknown[] = [];
    let where = '1=1';
    if(monthExpr){ 
      params.push(monthExpr); 
      where += ` and date_trunc('month', hx.data_hora) = date_trunc('month', $${params.length}::date)`; 
    } else { 
      where += ' and date_trunc(\'month\', hx.data_hora) = date_trunc(\'month\', now())'; 
    }
    if(departamentoId){ 
      params.push(departamentoId); 
      where += ` and f.departamento_id = $${params.length}`; 
    }
    
    const sql = `
      SELECT 
        f.id as user_id,
        f.nome,
        f.posicao_ranking_mensal as posicao,
        COALESCE(SUM(CASE WHEN hx.xp_ganho > 0 THEN hx.xp_ganho ELSE 0 END), 0) as xp_mes
      FROM user_service.funcionarios f
      LEFT JOIN gamification_service.historico_xp hx ON hx.funcionario_id = f.id
      WHERE ${where} AND f.ativo = true
      GROUP BY f.id, f.nome, f.posicao_ranking_mensal
      ORDER BY xp_mes DESC, f.criado_em ASC
      LIMIT 50
    `;
    
    const r = await c.query(sql, params);
    return r.rows.map((row, idx)=> ({ 
      posicao: row.posicao || (idx + 1),
      userId: row.user_id, 
      nome: row.nome,
      xpMes: Number(row.xp_mes) 
    }));
  });
}

export async function xpHistory(userId:string, limit=50, cursor?:string){
  return withClient(async c => {
  const params:unknown[] = [userId];
    let where = 'funcionario_id=$1';
    if(cursor){ params.push(cursor); where += ` and id < $${params.length}`; }
    const sql = `select id, xp_ganho, motivo, referencia_id from gamification_service.historico_xp
                 where ${where} order by id desc limit ${limit}`;
    const r = await c.query(sql, params);
    return r.rows;
  });
}