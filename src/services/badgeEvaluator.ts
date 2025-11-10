import type { PoolClient } from 'pg'
import { logger } from '../config/logger.js'

/**
 * Sistema de avaliação de badges baseado em critérios dinâmicos
 * 
 * Formato dos critérios:
 * - "concluiu_n_cursos:5" -> Concluir 5 cursos
 * - "concluiu_n_areas_diferentes:5" -> Concluir cursos de 5 áreas diferentes
 * - "xp_total:3000" -> Atingir 3000 XP
 * - "cursos_mesma_categoria:3" -> 3 cursos da mesma categoria
 * - "streak_dias:7" -> 7 dias seguidos estudando
 */

export interface Badge {
  codigo: string
  nome: string
  descricao: string | null
  criterio: string | null
  icone_url: string | null
  pontos_necessarios: number | null
}

export interface BadgeAwardResult {
  badgeCode: string
  awarded: boolean
  alreadyOwned: boolean
  reason?: string
}

/**
 * Avalia TODOS os badges e concede os que o usuário merece
 */
export async function avaliarTodosBadges(
  client: PoolClient,
  userId: string,
  sourceEventId: string
): Promise<BadgeAwardResult[]> {
  // Buscar todos os badges
  const badgesResult = await client.query<Badge>(
    'SELECT * FROM gamification_service.badges ORDER BY codigo'
  )

  const results: BadgeAwardResult[] = []

  for (const badge of badgesResult.rows) {
    try {
      const result = await avaliarBadge(client, userId, badge, sourceEventId)
      results.push(result)
    } catch (err) {
      logger.error(
        { err, userId, badgeCode: badge.codigo },
        'error_evaluating_badge'
      )
      results.push({
        badgeCode: badge.codigo,
        awarded: false,
        alreadyOwned: false,
        reason: 'Erro ao avaliar badge',
      })
    }
  }

  return results
}

/**
 * Avalia um badge específico
 */
async function avaliarBadge(
  client: PoolClient,
  userId: string,
  badge: Badge,
  sourceEventId: string
): Promise<BadgeAwardResult> {
  // Verificar se usuário já possui o badge
  const hasBadge = await client.query(
    `SELECT 1 FROM gamification_service.funcionario_badges 
     WHERE funcionario_id = $1 AND badge_id = $2`,
    [userId, badge.codigo]
  )

  if ((hasBadge.rowCount ?? 0) > 0) {
    return {
      badgeCode: badge.codigo,
      awarded: false,
      alreadyOwned: true,
    }
  }

  // TODOS os badges DEVEM ter critério definido
  if (!badge.criterio) {
    logger.warn(
      { badgeCode: badge.codigo, userId },
      'badge_without_criteria_skipped'
    )
    return {
      badgeCode: badge.codigo,
      awarded: false,
      alreadyOwned: false,
      reason: 'Badge sem critério definido - adicione um critério válido',
    }
  }

  // Avaliar critério
  const mereceBadge = await avaliarCriterio(client, userId, badge.criterio)

  if (!mereceBadge) {
    return {
      badgeCode: badge.codigo,
      awarded: false,
      alreadyOwned: false,
      reason: 'Critério não atendido',
    }
  }

  // Atribuir badge
  await atribuirBadge(client, userId, badge.codigo, sourceEventId)

  return {
    badgeCode: badge.codigo,
    awarded: true,
    alreadyOwned: false,
  }
}

/**
 * Avalia um critério específico
 */
async function avaliarCriterio(
  client: PoolClient,
  userId: string,
  criterio: string
): Promise<boolean> {
  // Parsear critério (formato: "tipo:valor")
  const [tipo, valorStr] = criterio.split(':')
  const valor = parseInt(valorStr, 10)

  switch (tipo) {
    case 'concluiu_n_cursos':
      return await verificarCursosCompletos(client, userId, valor)

    case 'concluiu_n_areas_diferentes':
      return await verificarAreasDiferentes(client, userId, valor)

    case 'xp_total':
      return await verificarXpTotal(client, userId, valor)

    case 'cursos_mesma_categoria':
      return await verificarCursosMesmaCategoria(client, userId, valor)

    case 'streak_dias':
      return await verificarStreak(client, userId, valor)

    case 'pontos_necessarios':
      // Alias para xp_total
      return await verificarXpTotal(client, userId, valor)

    default:
      logger.warn({ criterio, userId }, 'criterio_desconhecido')
      return false
  }
}

// ============================================
// VERIFICADORES DE CRITÉRIOS
// ============================================

async function verificarCursosCompletos(
  client: PoolClient,
  userId: string,
  quantidade: number
): Promise<boolean> {
  const result = await client.query(
    `SELECT COUNT(*)::int as total 
     FROM progress_service.inscricoes 
     WHERE funcionario_id = $1 AND status = 'CONCLUIDO'`,
    [userId]
  )

  const total = result.rows[0]?.total || 0
  return total >= quantidade
}

async function verificarAreasDiferentes(
  client: PoolClient,
  userId: string,
  quantidade: number
): Promise<boolean> {
  const result = await client.query(
    `SELECT COUNT(DISTINCT c.departamento_id)::int as areas_distintas
     FROM progress_service.inscricoes i
     INNER JOIN course_service.cursos c ON i.curso_id = c.id
     WHERE i.funcionario_id = $1 AND i.status = 'CONCLUIDO'`,
    [userId]
  )

  const areas = result.rows[0]?.areas_distintas || 0
  return areas >= quantidade
}

async function verificarXpTotal(
  client: PoolClient,
  userId: string,
  xpMinimo: number
): Promise<boolean> {
  const result = await client.query(
    `SELECT xp_total FROM user_service.funcionarios WHERE id = $1`,
    [userId]
  )

  const xpTotal = Number(result.rows[0]?.xp_total) || 0
  return xpTotal >= xpMinimo
}

async function verificarCursosMesmaCategoria(
  client: PoolClient,
  userId: string,
  quantidade: number
): Promise<boolean> {
  const result = await client.query(
    `SELECT c.categoria_id, COUNT(*)::int as total
     FROM progress_service.inscricoes i
     INNER JOIN course_service.cursos c ON i.curso_id = c.id
     WHERE i.funcionario_id = $1 AND i.status = 'CONCLUIDO' AND c.categoria_id IS NOT NULL
     GROUP BY c.categoria_id
     HAVING COUNT(*) >= $2
     LIMIT 1`,
    [userId, quantidade]
  )

  return (result.rowCount ?? 0) > 0
}

async function verificarStreak(
  client: PoolClient,
  userId: string,
  diasMinimos: number
): Promise<boolean> {
  // Buscar dias únicos com atividade (módulos iniciados ou concluídos)
  const result = await client.query(
    `WITH dias_ativos AS (
       SELECT DISTINCT DATE(data_inicio) as dia
       FROM progress_service.progresso_modulos
       WHERE inscricao_id IN (
         SELECT id FROM progress_service.inscricoes WHERE funcionario_id = $1
       )
       AND data_inicio IS NOT NULL
       ORDER BY dia DESC
     ),
     sequencias AS (
       SELECT 
         dia,
         dia - (ROW_NUMBER() OVER (ORDER BY dia))::int * interval '1 day' as grupo
       FROM dias_ativos
     ),
     maior_sequencia AS (
       SELECT COUNT(*)::int as dias_consecutivos
       FROM sequencias
       GROUP BY grupo
       ORDER BY dias_consecutivos DESC
       LIMIT 1
     )
     SELECT COALESCE(dias_consecutivos, 0)::int as streak
     FROM maior_sequencia`,
    [userId]
  )

  const streak = result.rows[0]?.streak || 0
  return streak >= diasMinimos
}

// ============================================
// ATRIBUIÇÃO DE BADGE
// ============================================

async function atribuirBadge(
  client: PoolClient,
  userId: string,
  badgeCode: string,
  sourceEventId: string
): Promise<void> {
  // Inserir relacionamento
  await client.query(
    `INSERT INTO gamification_service.funcionario_badges (funcionario_id, badge_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, badgeCode]
  )

  logger.info({ userId, badgeCode }, 'badge_awarded')

  // TODO: Publicar evento de badge conquistado
  // await publishEvent('gamification.badge.awarded.v1', { userId, badgeCode })
}

/**
 * Avalia badges específicos para um evento de conclusão de curso
 */
export async function avaliarBadgesConclusaoCurso(
  client: PoolClient,
  userId: string,
  courseId: string,
  sourceEventId: string
): Promise<BadgeAwardResult[]> {
  logger.info({ userId, courseId }, 'evaluating_badges_for_course_completion')

  // Avaliar todos os badges
  const results = await avaliarTodosBadges(client, userId, sourceEventId)

  // Log dos badges conquistados
  const conquistados = results.filter(r => r.awarded)
  if (conquistados.length > 0) {
    logger.info(
      { userId, badges: conquistados.map(b => b.badgeCode) },
      'badges_awarded_on_course_completion'
    )
  }

  return results
}
