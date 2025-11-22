import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { loadOpenApi } from "./config/openapi.js";
import { logger } from "./config/logger.js";
import { gamificationRouter } from "./routes/gamificationRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createServer() {
  const app = express();
  app.use(express.json());
  const allowAll = process.env.ALLOW_ALL_ORIGINS === "true";
  app.use(
    cors({
      origin: allowAll
        ? (origin, cb) => cb(null, true)
        : (process.env.CORS_ORIGINS || "").split(",").filter(Boolean),
      credentials: true,
    })
  );
  app.use(cookieParser());

  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });

  app.get("/openapi.json", async (_req, res) => {
    try {
      const spec = await loadOpenApi("Gamification Service API");
      res.json(spec);
    } catch {
      res.status(500).json({ error: "Failed to load OpenAPI spec" });
    }
  });
  app.use("/gamification/v1", gamificationRouter);
  app.use(errorHandler);
  return app;
}
