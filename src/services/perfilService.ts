import { publishEvent } from '../config/rabbitmq.js'
import { withClient } from '../db.js'
import { updateUserScore } from '../config/redis.js'
import { logger } from '../config/logger.js'

function nivelFromXp(xp: number) {
  // Faixas definidas: Iniciante: 0-999, Intermediário: 1000-2999, Avançado: 3000+
  let label = 'Iniciante'
  if (xp >= 3000) label = 'Avançado'
  else if (xp >= 1000) label = 'Intermediário'
  // Próximo nível XP
  let proximoNivelXp = 1000
  if (xp >= 1000 && xp < 3000) proximoNivelXp = 3000
  else if (xp >= 3000) proximoNivelXp = xp // sem próximo definido
  return { nivelLabel: label, proximoNivelXp }
}

export async function adjustXp(
  userId: string,
  delta: number,
  sourceEventId: string,
  motivo?: string
) {
  if (delta === 0) return // ignorar neutros
  let newTotal = 0
  await withClient(async c => {
    // Idempotência via historico_xp.referencia_id
    const exists = await c.query(
      'SELECT 1 FROM gamification_service.historico_xp WHERE referencia_id = $1 LIMIT 1',
      [sourceEventId]
    )
    if ((exists.rowCount ?? 0) > 0) return

    await c.query(
      `INSERT INTO gamification_service.historico_xp 
       (funcionario_id, xp_ganho, motivo, referencia_id) 
       VALUES ($1, $2, $3, $4)`,
      [userId, delta, motivo || 'event', sourceEventId]
    )

    const upd = await c.query(
      `UPDATE user_service.funcionarios 
       SET xp_total = COALESCE(xp_total, 0) + $2 
       WHERE id = $1 
       RETURNING xp_total`,
      [userId, delta]
    )
    if ((upd.rowCount ?? 0) > 0) newTotal = Number(upd.rows[0].xp_total) || 0
  })

  if (newTotal) {
    const { nivelLabel } = nivelFromXp(newTotal)

    await withClient(async c => {
      // Atualiza nível se mudou
      await c.query(
        'UPDATE user_service.funcionarios SET nivel = $2 WHERE id = $1 AND nivel <> $2',
        [userId, nivelLabel]
      )
    })

    // Atualiza Redis (graceful degradation se falhar)
    updateUserScore(userId, newTotal).catch(err =>
      logger.error({ err, userId }, '⚠️ Falha ao atualizar Redis')
    )

    await publishEvent('xp.adjusted.v1', {
      userId,
      delta,
      newTotalXp: newTotal,
      level: nivelLabel,
      sourceEventId,
    })
  }
}

export async function getRankingGlobal() {
  return withClient(async c => {
    const { rows } = await c.query(`
      SELECT 
        funcionario_id as user_id,
        nome,
        xp_total as xp,
        posicao_geral as posicao
      FROM gamification_service.ranking
      ORDER BY posicao_geral ASC
      LIMIT 50
    `)
    return rows
  })
}
