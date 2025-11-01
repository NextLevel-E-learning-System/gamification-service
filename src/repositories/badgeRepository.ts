import { withClient } from '../db.js';

export interface Badge {
  codigo: string;
  nome: string;
  descricao?: string;
  criterio?: string;
  icone_url?: string;
  pontos_necessarios?: number;
  criado_em?: Date;
}

export interface NewBadge {
  codigo: string;
  nome: string;
  descricao?: string;
  criterio?: string;
  icone_url?: string;
  pontos_necessarios?: number;
}

export interface UpdateBadge {
  nome?: string;
  descricao?: string;
  criterio?: string;
  icone_url?: string;
  pontos_necessarios?: number;
}

// CREATE
export async function insertBadge(data: NewBadge): Promise<Badge> {
  return withClient(async (c) => {
    const result = await c.query(
      `INSERT INTO gamification_service.badges 
       (codigo, nome, descricao, criterio, icone_url, pontos_necessarios) 
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING codigo, nome, descricao, criterio, icone_url, pontos_necessarios, criado_em`,
      [
        data.codigo,
        data.nome,
        data.descricao || null,
        data.criterio || null,
        data.icone_url || null,
        data.pontos_necessarios || 0,
      ]
    );
    return result.rows[0];
  });
}

// READ - Single
export async function findBadge(codigo: string): Promise<Badge | null> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT codigo, nome, descricao, criterio, icone_url, pontos_necessarios, criado_em
       FROM gamification_service.badges 
       WHERE codigo = $1`,
      [codigo]
    );
    return result.rows[0] || null;
  });
}

// READ - List
export async function listBadges(): Promise<Badge[]> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT codigo, nome, descricao, criterio, icone_url, pontos_necessarios, criado_em
       FROM gamification_service.badges 
       ORDER BY criado_em DESC`
    );
    return result.rows;
  });
}

// UPDATE
export async function updateBadge(codigo: string, data: UpdateBadge): Promise<Badge | null> {
  return withClient(async (c) => {
    const fields: string[] = [];
    const values: Array<string | number> = [];
    let paramCount = 1;

    if (data.nome !== undefined) {
      fields.push(`nome = $${paramCount++}`);
      values.push(data.nome);
    }
    if (data.descricao !== undefined) {
      fields.push(`descricao = $${paramCount++}`);
      values.push(data.descricao);
    }
    if (data.criterio !== undefined) {
      fields.push(`criterio = $${paramCount++}`);
      values.push(data.criterio);
    }
    if (data.icone_url !== undefined) {
      fields.push(`icone_url = $${paramCount++}`);
      values.push(data.icone_url);
    }
    if (data.pontos_necessarios !== undefined) {
      fields.push(`pontos_necessarios = $${paramCount++}`);
      values.push(data.pontos_necessarios);
    }

    if (fields.length === 0) {
      return findBadge(codigo);
    }

    fields.push(`atualizado_em = now()`);
    values.push(codigo);

    const query = `
      UPDATE gamification_service.badges 
      SET ${fields.join(', ')}
      WHERE codigo = $${paramCount}
      RETURNING codigo, nome, descricao, criterio, icone_url, pontos_necessarios, criado_em
    `;

    const result = await c.query(query, values);
    return result.rows[0] || null;
  });
}

// DELETE
export async function deleteBadge(codigo: string): Promise<boolean> {
  return withClient(async (c) => {
    // Primeiro remove as conquistas dos funcionários
    await c.query(
      'DELETE FROM gamification_service.funcionario_badges WHERE badge_id = $1',
      [codigo]
    );
    
    // Depois remove o badge
    const result = await c.query(
      'DELETE FROM gamification_service.badges WHERE codigo = $1',
      [codigo]
    );
    
    return (result.rowCount ?? 0) > 0;
  });
}

// Conquistas de usuário
export async function getUserBadges(userId: string): Promise<Badge[]> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT b.codigo, b.nome, b.descricao, b.criterio, b.icone_url, 
              b.pontos_necessarios, fb.data_conquista as criado_em
       FROM gamification_service.funcionario_badges fb
       JOIN gamification_service.badges b ON b.codigo = fb.badge_id
       WHERE fb.funcionario_id = $1
       ORDER BY fb.data_conquista DESC`,
      [userId]
    );
    return result.rows;
  });
}

// Verificar se usuário tem badge
export async function userHasBadge(userId: string, badgeCode: string): Promise<boolean> {
  return withClient(async (c) => {
    const result = await c.query(
      `SELECT 1 FROM gamification_service.funcionario_badges 
       WHERE funcionario_id = $1 AND badge_id = $2`,
      [userId, badgeCode]
    );
    return (result.rowCount ?? 0) > 0;
  });
}

// Atribuir badge a usuário
export async function awardBadgeToUser(userId: string, badgeCode: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO gamification_service.funcionario_badges (funcionario_id, badge_id)
       VALUES ($1, $2)
       ON CONFLICT (funcionario_id, badge_id) DO NOTHING`,
      [userId, badgeCode]
    );
  });
}
