import { connect, Channel } from 'amqplib';
import { adjustXp } from '../services/perfilService.js';
import { withClient } from '../db.js';
import { logger } from '../config/logger.js';

const EXCHANGE = 'domain.events';
let channel: Channel | null = null;

export async function startConsumer(){
  const url = process.env.RABBITMQ_URL;
  if(!url){ logger.warn('RABBITMQ_URL not set, consumer disabled'); return; }
  const maxAttempts=10; const baseDelay=500;
  for(let attempt=1; attempt<=maxAttempts; attempt++){
    try {
      const conn = await connect(url);
      channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE,'topic',{ durable:true });
      const q = await channel.assertQueue('gamification.events', { durable:true });
      await channel.bindQueue(q.queue, EXCHANGE, 'course.*.completed.*'); // pattern simplificado
      await channel.consume(q.queue, async msg => {
        if(!msg) return;
        try {
          const content = msg.content.toString();
          const evt = JSON.parse(content) as DomainEvent;
          await persistEvent(evt);
          await handleEvent(evt);
          channel?.ack(msg);
        } catch(err){ logger.error({ err }, 'error_processing_event'); channel?.nack(msg,false,false); }
      });
      logger.info('gamification consumer started');
      return;
    } catch(err){
      const delay = baseDelay * attempt;
      logger.warn({ attempt, delay, err }, 'consumer_connect_retry');
      await new Promise(r=>setTimeout(r, delay));
    }
  }
  logger.error('failed_to_start_consumer');
}

interface DomainEvent<T = unknown>{ eventId:string; type:string; occurredAt:string; payload:T }
interface ModuleCompletedPayload { enrollmentId:string; courseId:string; userId:string; moduleId:string; progressPercent:number; completedCourse:boolean }
interface CourseCompletedPayload { enrollmentId:string; courseId:string; userId:string; totalProgress:number }

async function persistEvent(evt:DomainEvent){
  await withClient(c => c.query('insert into events_store(event_id,type,occurred_at,payload) values($1,$2,$3,$4) on conflict do nothing', [evt.eventId, evt.type, evt.occurredAt, evt.payload]));
}

async function handleEvent(evt:DomainEvent){
  switch(evt.type){
    case 'course.module.completed.v1':
      await onModuleCompleted(evt as DomainEvent<ModuleCompletedPayload>);
      break;
    case 'course.completed.v1':
      await onCourseCompleted(evt as DomainEvent<CourseCompletedPayload>);
      break;
    default:
      break;
  }
}

async function onModuleCompleted(evt:DomainEvent<ModuleCompletedPayload>){
  const { userId } = evt.payload;
  // Regra simples: cada módulo concluído concede 50 XP; bônus 100 XP se curso concluído sinalizado no evento
  let delta = 50;
  if(evt.payload.completedCourse) delta += 100;
  await adjustXp(userId, delta, evt.eventId);
}

async function onCourseCompleted(evt:DomainEvent<CourseCompletedPayload>){
  const { userId } = evt.payload;
  // Sem XP extra (já adicionado no último módulo). Avaliar badges.
  await avaliarBadges(userId, evt.eventId);
}

async function avaliarBadges(userId:string, sourceEventId:string){
  await withClient(async c => {
    // Primeiro Curso: se total de cursos concluídos =1 atribuir badge PRIMEIRO_CURSO
    const concl = await c.query(`select count(*)::int as total from progress_service.inscricoes where funcionario_id=$1 and status='CONCLUIDO'`,[userId]);
    const total = concl.rows[0].total as number;
    if(total===1){
      await atribuirBadge(c, userId, 'PRIMEIRO_CURSO', sourceEventId);
    }
    // Maratonista: 5 cursos no mês atual
    const maratona = await c.query(`select count(*)::int as cnt from progress_service.inscricoes 
      where funcionario_id=$1 and status='CONCLUIDO' and date_trunc('month', data_conclusao)=date_trunc('month', now())`,[userId]);
    if((maratona.rows[0].cnt as number) === 5){
      await atribuirBadge(c, userId, 'MARATONISTA', sourceEventId);
    }
    // EXPERT: XP total >= 3000
    const xpRes = await c.query('select xp_total from user_service.funcionarios where id=$1',[userId]);
    const xp = Number(xpRes.rows[0]?.xp_total)||0;
    if(xp >= 3000){
      await atribuirBadge(c, userId, 'EXPERT', sourceEventId);
    }
  });
}

import type { PoolClient } from 'pg';
async function atribuirBadge(c:PoolClient, userId:string, codigo:string, sourceEventId:string){
  // Garantir existência do badge base (idempotente)
  await c.query(`insert into gamification_service.badges(codigo,nome,descricao) values($1,$1,$1)
    on conflict (codigo) do nothing`,[codigo]);
  // Verifica se já possui
  const has = await c.query('select 1 from gamification_service.funcionario_badges where funcionario_id=$1 and badge_id=$2',[userId, codigo]);
  if((has.rowCount ?? 0) > 0) return;
  await c.query('insert into gamification_service.funcionario_badges(funcionario_id,badge_id) values($1,$2)',[userId,codigo]);
  // Registrar histórico opcional (usando historico_xp motivo=badge com xp 0)
  await c.query('insert into gamification_service.historico_xp(id, funcionario_id, xp_ganho, motivo, referencia_id) values (gen_random_uuid(), $1, 0, $2, $3)',[userId, `badge:${codigo}`, sourceEventId]);
}
