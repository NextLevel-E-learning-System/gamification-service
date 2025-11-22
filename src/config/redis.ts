import Redis from "ioredis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const LEADERBOARD_KEY = process.env.REDIS_LEADERBOARD_KEY || "leaderboard:xp";

// Cliente Redis com retry strategy
const redis = new Redis(REDIS_URL, {
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect", () => {
  logger.info("✅ Redis conectado com sucesso");
});

redis.on("error", (err) => {
  logger.error({ err }, "❌ Erro no Redis");
});

redis.on("close", () => {
  logger.warn("⚠️  Conexão Redis fechada");
});

/**
 * Atualiza o score (XP) de um usuário no leaderboard
 */
export async function updateUserScore(
  userId: string,
  xp: number
): Promise<void> {
  await redis.zadd(LEADERBOARD_KEY, xp, `user:${userId}`);
}

/**
 * Retorna o ranking geral (top N usuários)
 */
export async function getTopRanking(
  limit = 50
): Promise<Array<{ userId: string; xp: number; posicao: number }>> {
  try {
    // ZREVRANGE retorna do maior para o menor score
    const results = await redis.zrevrange(
      LEADERBOARD_KEY,
      0,
      limit - 1,
      "WITHSCORES"
    );

    const ranking: Array<{ userId: string; xp: number; posicao: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      const userKey = results[i]; // "user:123"
      const xp = parseFloat(results[i + 1]);
      const userId = userKey.replace("user:", "");

      ranking.push({
        userId,
        xp,
        posicao: i / 2 + 1,
      });
    }

    return ranking;
  } catch (error) {
    logger.error({ error }, "Erro ao buscar ranking");
    throw error;
  }
}

/**
 * Retorna a posição de um usuário no ranking
 */
export async function getUserRank(
  userId: string
): Promise<{ posicao: number | null; xp: number }> {
  try {
    const userKey = `user:${userId}`;

    // ZREVRANK retorna a posição (0-based) do maior para o menor
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userKey);
    const score = await redis.zscore(LEADERBOARD_KEY, userKey);

    return {
      posicao: rank !== null ? rank + 1 : null, // Converter para 1-based
      xp: score ? parseFloat(score) : 0,
    };
  } catch (error) {
    logger.error(
      { error, userId },
      `Erro ao buscar posição do usuário ${userId}`
    );
    throw error;
  }
}

/**
 * Sincroniza dados do PostgreSQL para o Redis (usar em job/cron)
 */
export async function syncLeaderboardFromDB(
  users: Array<{ userId: string; xp: number }>
): Promise<void> {
  try {
    const pipeline = redis.pipeline();

    // Limpa o leaderboard atual
    pipeline.del(LEADERBOARD_KEY);

    // Adiciona todos os usuários
    for (const user of users) {
      pipeline.zadd(LEADERBOARD_KEY, user.xp, `user:${user.userId}`);
    }

    await pipeline.exec();
    logger.info(`✅ Leaderboard sincronizado: ${users.length} usuários`);
  } catch (error) {
    logger.error({ error }, "Erro ao sincronizar leaderboard");
    throw error;
  }
}

export { redis, LEADERBOARD_KEY };
export default redis;
