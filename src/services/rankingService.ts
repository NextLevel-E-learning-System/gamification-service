import { withClient } from '../db.js';

export async function rankingMensal(mes?:string, departamentoId?:string){
  // mes formato YYYY-MM; se omitido usa mês atual (do próprio ranking já calculado)
  return withClient(async c => {
    let where = '1=1';
    const params: unknown[] = [];
    
    if (departamentoId) {
      params.push(departamentoId);
      where += ` AND departamento_id = $${params.length}`;
    }
    
    // Se mes foi especificado, precisamos recalcular para aquele mês
    // Senão, usa o ranking já calculado (mês atual)
    if (mes) {
      const monthExpr = `${mes}-01`;
      params.push(monthExpr);
      
      const sql = `
        WITH xp_mensal AS (
          SELECT 
            hx.funcionario_id,
            COALESCE(SUM(CASE WHEN hx.xp_ganho > 0 THEN hx.xp_ganho ELSE 0 END), 0) as xp_mes
          FROM gamification_service.historico_xp hx
          WHERE DATE_TRUNC('month', hx.data_hora) = DATE_TRUNC('month', $${params.length}::date)
          GROUP BY hx.funcionario_id
        ),
        ranking_calculado AS (
          SELECT 
            r.funcionario_id,
            r.nome,
            COALESCE(xm.xp_mes, 0) as xp_mes,
            r.departamento_id,
            ROW_NUMBER() OVER (ORDER BY COALESCE(xm.xp_mes, 0) DESC, r.nome ASC) as posicao
          FROM gamification_service.ranking r
          LEFT JOIN xp_mensal xm ON xm.funcionario_id = r.funcionario_id
          WHERE ${where}
        )
        SELECT 
          posicao,
          funcionario_id as "userId",
          nome,
          xp_mes as "xpMes"
        FROM ranking_calculado
        ORDER BY posicao ASC
        LIMIT 50
      `;
      
      const r = await c.query(sql, params);
      return r.rows;
    } else {
      // Usa o ranking mensal já calculado
      const sql = `
        SELECT 
          posicao_mensal as posicao,
          funcionario_id as "userId",
          nome,
          xp_mes as "xpMes"
        FROM gamification_service.ranking
        WHERE ${where}
        ORDER BY posicao_mensal ASC
        LIMIT 50
      `;
      
      const r = await c.query(sql, params);
      return r.rows;
    }
  });
}