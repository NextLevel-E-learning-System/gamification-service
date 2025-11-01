import { connect, Channel } from 'amqplib';
import { adjustXp } from '../services/perfilService.js';
import { withClient } from '../db.js';
import { logger } from '../config/logger.js';
import type { PoolClient } from 'pg';

const EXCHANGE = 'domain.events';
let channel: Channel | null = null;

export async function startConsumer() {
  const url = process.env.RABBITMQ_URL;
  if (!url) {
    logger.warn('RABBITMQ_URL not set, consumer disabled');
    return;
  }

  const maxAttempts = 10;
  const baseDelay = 500;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conn = await connect(url);
      channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

      const q = await channel.assertQueue('gamification.events', { durable: true });

      // Subscrever aos eventos relevantes
      await channel.bindQueue(q.queue, EXCHANGE, 'progress.module.completed.v1');
      await channel.bindQueue(q.queue, EXCHANGE, 'progress.course.completed.v1');
      await channel.bindQueue(q.queue, EXCHANGE, 'assessment.passed.v1');

      await channel.consume(q.queue, async (msg) => {
        if (!msg) return;

        try {
          const content = msg.content.toString();
          const evt = JSON.parse(content) as DomainEvent;
          
          logger.info({ eventId: evt.eventId, type: evt.type }, 'processing_event');
          
          await handleEvent(evt);
          channel?.ack(msg);
        } catch (err) {
          logger.error({ err }, 'error_processing_event');
          channel?.nack(msg, false, false);
        }
      });

      logger.info('gamification consumer started');
      return;
    } catch (err) {
      const delay = baseDelay * attempt;
      logger.warn({ attempt, delay, err }, 'consumer_connect_retry');
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  logger.error('failed_to_start_consumer');
}

// ========== TIPOS DE EVENTOS ==========
interface DomainEvent<T = unknown> {
  eventId: string;
  type: string;
  occurredAt: string;
  payload: T;
}

interface ModuleCompletedPayload {
  enrollmentId: string;
  courseId: string;
  userId: string;
  moduleId: string;
  xpEarned: number;
  progressPercent: number;
}

interface CourseCompletedPayload {
  enrollmentId: string;
  courseId: string;
  userId: string;
  totalXp: number;
}

interface AssessmentPassedPayload {
  assessmentCode: string;
  courseId: string;
  userId: string;
  score: number;
  passed: boolean;
}

// ========== HANDLER DE EVENTOS ==========
async function handleEvent(evt: DomainEvent) {
  switch (evt.type) {
    case 'progress.module.completed.v1':
      await onModuleCompleted(evt as DomainEvent<ModuleCompletedPayload>);
      break;
    case 'progress.course.completed.v1':
      await onCourseCompleted(evt as DomainEvent<CourseCompletedPayload>);
      break;
    case 'assessment.passed.v1':
      await onAssessmentPassed(evt as DomainEvent<AssessmentPassedPayload>);
      break;
    default:
      logger.debug({ type: evt.type }, 'event_type_ignored');
      break;
  }
}

// ========== MÓDULO CONCLUÍDO ==========
async function onModuleCompleted(evt: DomainEvent<ModuleCompletedPayload>) {
  const { userId, xpEarned, moduleId } = evt.payload;
  
  logger.info(
    { userId, moduleId, xpEarned },
    'module_completed_processing_xp'
  );

  // Registra XP do módulo
  if (xpEarned > 0) {
    await adjustXp(userId, xpEarned, evt.eventId, `modulo:${moduleId}`);
  }
}

// ========== CURSO CONCLUÍDO ==========
async function onCourseCompleted(evt: DomainEvent<CourseCompletedPayload>) {
  const { userId, courseId } = evt.payload;

  logger.info({ userId, courseId }, 'course_completed_evaluating_badges');

  // Avaliar conquistas de badges
  await avaliarBadges(userId, courseId, evt.eventId);
}

// ========== AVALIAÇÃO APROVADA ==========
async function onAssessmentPassed(evt: DomainEvent<AssessmentPassedPayload>) {
  const { userId, score, assessmentCode } = evt.payload;

  logger.info({ userId, assessmentCode, score }, 'assessment_passed_processing_xp');

  // Registra XP da avaliação
  const xpBonus = Math.round(score * 0.5); // 50% da nota como XP bônus
  if (xpBonus > 0) {
    await adjustXp(userId, xpBonus, evt.eventId, `avaliacao:${assessmentCode}`);
  }

  // Verificar badge de primeira aprovação
  await withClient(async (c) => {
    const aprovacoes = await c.query(
      `SELECT COUNT(*)::int as total 
       FROM assessment_service.tentativas 
       WHERE funcionario_id = $1 AND status = 'CONCLUIDO' AND nota_obtida >= (
         SELECT nota_minima FROM assessment_service.avaliacoes WHERE codigo = avaliacao_id LIMIT 1
       )`,
      [userId]
    );

    if ((aprovacoes.rows[0]?.total as number) === 1) {
      await atribuirBadge(c, userId, 'PRIMEIRA_APROVACAO', evt.eventId);
    }
  });
}

// ========== AVALIAR BADGES AUTOMÁTICOS ==========
async function avaliarBadges(userId: string, courseId: string, sourceEventId: string) {
  await withClient(async (c) => {
    // Badge: PRIMEIRO_CURSO
    const cursosCompletos = await c.query(
      `SELECT COUNT(*)::int as total 
       FROM progress_service.inscricoes 
       WHERE funcionario_id = $1 AND status = 'CONCLUIDO'`,
      [userId]
    );

    if ((cursosCompletos.rows[0]?.total as number) === 1) {
      await atribuirBadge(c, userId, 'PRIMEIRO_CURSO', sourceEventId);
    }

    // Badge: MARATONISTA (5 cursos no mês atual)
    const cursosNoMes = await c.query(
      `SELECT COUNT(*)::int as total 
       FROM progress_service.inscricoes 
       WHERE funcionario_id = $1 
         AND status = 'CONCLUIDO' 
         AND date_trunc('month', data_conclusao) = date_trunc('month', now())`,
      [userId]
    );

    if ((cursosNoMes.rows[0]?.total as number) === 5) {
      await atribuirBadge(c, userId, 'MARATONISTA', sourceEventId);
    }

    // Badge: EXPERT (XP total >= 3000)
    const xpTotal = await c.query(
      'SELECT xp_total FROM user_service.funcionarios WHERE id = $1',
      [userId]
    );

    const xp = Number(xpTotal.rows[0]?.xp_total) || 0;
    if (xp >= 3000) {
      await atribuirBadge(c, userId, 'EXPERT', sourceEventId);
    }

    logger.info({ userId, courseId, cursosCompletos: cursosCompletos.rows[0]?.total }, 'badges_evaluated');
  });
}

// ========== ATRIBUIR BADGE ==========
async function atribuirBadge(
  c: PoolClient,
  userId: string,
  badgeCode: string,
  sourceEventId: string
) {
  // Garantir que o badge existe (criar se não existir)
  await c.query(
    `INSERT INTO gamification_service.badges (codigo, nome, descricao)
     VALUES ($1, $1, 'Badge automático: ' || $1)
     ON CONFLICT (codigo) DO NOTHING`,
    [badgeCode]
  );

  // Verificar se usuário já possui o badge
  const hasBadge = await c.query(
    `SELECT 1 FROM gamification_service.funcionario_badges 
     WHERE funcionario_id = $1 AND badge_id = $2`,
    [userId, badgeCode]
  );

  if ((hasBadge.rowCount ?? 0) > 0) {
    logger.debug({ userId, badgeCode }, 'badge_already_owned');
    return;
  }

  // Atribuir badge
  await c.query(
    `INSERT INTO gamification_service.funcionario_badges (funcionario_id, badge_id)
     VALUES ($1, $2)`,
    [userId, badgeCode]
  );

  logger.info({ userId, badgeCode }, 'badge_awarded');

  // Registrar no histórico (com XP zero, apenas para tracking)
  await c.query(
    `INSERT INTO gamification_service.historico_xp 
     (funcionario_id, xp_ganho, motivo, referencia_id)
     VALUES ($1, 0, $2, $3)`,
    [userId, `badge:${badgeCode}`, `badge:${badgeCode}:${sourceEventId}`]
  );
}

