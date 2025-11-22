import { withClient } from '../db.js'

export async function rankingMensal(departamentoId?: string) {
  return withClient(async c => {
    const params: unknown[] = []
    let where = '1=1'

    if (departamentoId) {
      params.push(departamentoId)
      where += ` AND departamento_id = $${params.length}`
    }

    const { rows } = await c.query(
      `SELECT 
        posicao_mensal as posicao,
        funcionario_id as "userId",
        nome,
        xp_mes as "xpMes"
      FROM gamification_service.ranking
      WHERE ${where}
      ORDER BY posicao_mensal ASC
      LIMIT 50`,
      params
    )

    return rows
  })
}
