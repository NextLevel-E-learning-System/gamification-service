import { logger } from '../config/logger.js'
import { syncLeaderboardFromDB } from '../config/redis.js'
import { withClient } from '../db.js'

/**
 * Sincroniza o leaderboard do PostgreSQL para o Redis
 * Deve ser executado periodicamente (ex: 1x por dia às 00:00)
 */
export async function syncLeaderboardJob(): Promise<void> {
  try {
    logger.info('🔄 Iniciando sincronização do leaderboard...')

    const users = await withClient(async c => {
      const result = await c.query(`
        SELECT 
          funcionario_id as "userId",
          xp_total as xp
        FROM gamification_service.ranking
        WHERE xp_total > 0
        ORDER BY xp_total DESC
      `)

      return result.rows.map((row: { userId: string; xp: number }) => ({
        userId: row.userId,
        xp: Number(row.xp) || 0,
      }))
    })

    await syncLeaderboardFromDB(users)

    logger.info(`✅ Sincronização concluída: ${users.length} usuários no leaderboard`)
  } catch (error) {
    logger.error({ error }, '❌ Erro na sincronização do leaderboard')
    throw error
  }
}

/**
 * Inicia o job de sincronização periódica
 * Executa a cada 24 horas (ou conforme configurado)
 */
export function startLeaderboardSyncJob(): void {
  const SYNC_INTERVAL = Number(process.env.REDIS_SYNC_INTERVAL_HOURS) || 24
  const intervalMs = SYNC_INTERVAL * 60 * 60 * 1000 // Converter horas para ms

  // Executa imediatamente na inicialização
  syncLeaderboardJob().catch(error => {
    logger.error({ error }, '❌ Erro na sincronização inicial')
  })

  // Depois executa periodicamente
  setInterval(() => {
    syncLeaderboardJob().catch(error => {
      logger.error({ error }, '❌ Erro na sincronização periódica')
    })
  }, intervalMs)

  logger.info(`⏰ Job de sincronização do leaderboard iniciado (a cada ${SYNC_INTERVAL}h)`)
}
