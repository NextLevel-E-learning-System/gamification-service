import { withClient } from '../db.js';
export async function insertBadge(d:any){ await withClient(c=>c.query('insert into badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) values ($1,$2,$3,$4,$5,$6)',[d.codigo,d.nome,d.descricao||null,d.criterio||null,d.icone_url||null,d.pontos_necessarios])); }
export async function findBadge(codigo:string){ return withClient(async c=>{ const r = await c.query('select codigo, nome, descricao, criterio, icone_url, pontos_necessarios from badges where codigo=$1',[codigo]); return r.rows[0]; }); }
