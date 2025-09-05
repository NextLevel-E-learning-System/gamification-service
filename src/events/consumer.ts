import { connect, Channel } from 'amqplib';
import { withClient } from '../db.js';
import { adjustXp } from '../services/perfilService.js';
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
  // Bônus adicional de curso completo (se não já dado no módulo final) - proteger duplicidade com idempotência via xp_events unique? Simplificado
  await adjustXp(userId, 0, evt.eventId); // neutro; já contou no módulo final
}
