import { insertBadge, findBadge } from '../repositories/badgeRepository.js';
import { HttpError } from '../utils/httpError.js';
export async function createBadge(d:any){ try { await insertBadge(d); return { codigo:d.codigo }; } catch(err:any){ if(err.code==='23505') throw new HttpError(409,'duplicado'); throw err; } }
export async function getBadge(codigo:string){ const b = await findBadge(codigo); if(!b) throw new HttpError(404,'nao_encontrado'); return b; }
