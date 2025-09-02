import { z } from 'zod';
export const createBadgeSchema = z.object({ codigo:z.string(), nome:z.string(), descricao:z.string().optional(), criterio:z.string().optional(), icone_url:z.string().url().optional(), pontos_necessarios:z.number().int().positive() });
