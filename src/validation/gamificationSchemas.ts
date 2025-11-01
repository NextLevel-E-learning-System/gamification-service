import { z } from 'zod';

export const createBadgeSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().optional(),
  criterio: z.string().optional(),
  icone_url: z.string().url('URL inválida').optional().or(z.literal('')),
  pontos_necessarios: z.number().int().nonnegative('Pontos devem ser não-negativos').optional(),
});

export const updateBadgeSchema = z.object({
  nome: z.string().min(1, 'Nome não pode ser vazio').optional(),
  descricao: z.string().optional(),
  criterio: z.string().optional(),
  icone_url: z.string().url('URL inválida').optional().or(z.literal('')),
  pontos_necessarios: z.number().int().nonnegative('Pontos devem ser não-negativos').optional(),
});

