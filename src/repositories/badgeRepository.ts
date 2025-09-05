import { withClient } from '../db.js';
interface NewBadge { codigo:string; nome:string; descricao?:string; criterio?:string; icone_url?:string; pontos_necessarios?:number }
export async function insertBadge(d:NewBadge){ await withClient(c=>c.query('insert into gamification_service.badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) values ($1,$2,$3,$4,$5,$6)',[d.codigo,d.nome,d.descricao||null,d.criterio||null,d.icone_url||null,d.pontos_necessarios||0])); }
export async function findBadge(codigo:string){ return withClient(async c=>{ const r = await c.query('select codigo, nome, descricao, criterio, icone_url, pontos_necessarios from gamification_service.badges where codigo=$1',[codigo]); return r.rows[0]; }); }
export async function listBadges(){ return withClient(async c=>{ const r = await c.query('select codigo, nome, descricao, criterio, icone_url, pontos_necessarios from gamification_service.badges order by codigo'); return r.rows; }); }
