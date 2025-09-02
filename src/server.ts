import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { z } from 'zod';
import { withClient } from './db.js';
 
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin: '*'}));
  app.use((req, _res, next) => { (req as any).log = logger; next(); });

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) => res.json({ status: 'ok' }));

  app.post('/gamification/v1/badges', async (req, res) => {
    const schema = z.object({ codigo: z.string(), nome: z.string(), descricao: z.string().optional(), criterio: z.string().optional(), icone_url: z.string().url().optional(), pontos_necessarios: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'validation_error', details: parsed.error.issues });
    try {
      await withClient(c => c.query('insert into badges (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) values ($1,$2,$3,$4,$5,$6)', [parsed.data.codigo, parsed.data.nome, parsed.data.descricao || null, parsed.data.criterio || null, parsed.data.icone_url || null, parsed.data.pontos_necessarios]));
      res.status(201).json({ codigo: parsed.data.codigo });
    } catch (err:any) {
      if (err.code === '23505') return res.status(409).json({ error: 'duplicado' });
      logger.error({ err }, 'create_badge_failed');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  app.get('/gamification/v1/badges/:codigo', async (req, res) => {
    try {
      const row = await withClient(async c => {
        const r = await c.query('select codigo, nome, descricao, criterio, icone_url, pontos_necessarios from badges where codigo=$1', [req.params.codigo]);
        return r.rows[0];
      });
      if (!row) return res.status(404).json({ error: 'nao_encontrado' });
      res.json(row);
    } catch (err:any) {
      logger.error({ err }, 'get_badge_failed');
      res.status(500).json({ error: 'internal_error' });
    }
  });

  return app;
}