import { connect, Channel } from 'amqplib';
import { adjustXp } from '../services/perfilService.js';
import { withClient } from '../db.js';
import { logger } from '../config/logger.js';
import { avaliarBadgesConclusaoCurso, avaliarTodosBadges } from '../services/badgeEvaluator.js';

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
    
    // Avaliar badges após ganhar XP (pode desbloquear badges de XP)
    await withClient(async (c) => {
      const results = await avaliarTodosBadges(c, userId, evt.eventId);
      const conquistados = results.filter(r => r.awarded);
      
      if (conquistados.length > 0) {
        logger.info(
          { userId, moduleId, badges: conquistados.map(b => b.badgeCode) },
          'badges_awarded_after_module'
        );
      }
    });
  }
}

// ========== CURSO CONCLUÍDO ==========
async function onCourseCompleted(evt: DomainEvent<CourseCompletedPayload>) {
  const { userId, courseId } = evt.payload;

  logger.info({ userId, courseId }, 'course_completed_evaluating_badges');

  // Avaliar conquistas de badges usando o novo sistema
  await withClient(async (c) => {
    const results = await avaliarBadgesConclusaoCurso(c, userId, courseId, evt.eventId);
    
    const conquistados = results.filter(r => r.awarded);
    if (conquistados.length > 0) {
      logger.info(
        { userId, courseId, badges: conquistados.map(b => b.badgeCode) },
        'badges_awarded'
      );
    }
  });
}

// ========== AVALIAÇÃO APROVADA ==========
async function onAssessmentPassed(evt: DomainEvent<AssessmentPassedPayload>) {
  const { userId, score, assessmentCode } = evt.payload;

  logger.info({ userId, assessmentCode, score }, 'assessment_passed_processing');

  // Registra XP da avaliação
  const xpBonus = Math.round(score * 0.5); // 50% da nota como XP bônus
  if (xpBonus > 0) {
    await adjustXp(userId, xpBonus, evt.eventId, `avaliacao:${assessmentCode}`);
    
    // Avaliar badges após ganhar XP
    await withClient(async (c) => {
      const results = await avaliarTodosBadges(c, userId, evt.eventId);
      const conquistados = results.filter(r => r.awarded);
      
      if (conquistados.length > 0) {
        logger.info(
          { userId, assessmentCode, badges: conquistados.map(b => b.badgeCode) },
          'badges_awarded_after_assessment'
        );
      }
    });
  }
}