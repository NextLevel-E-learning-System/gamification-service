import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { loadOpenApi } from './config/openapi.js';
import { logger } from './config/logger.js';
import { gamificationRouter } from './routes/gamificationRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createServer(){
	const app=express();
	app.use(express.json());
	app.use(cors({origin:'*'}));
	app.use((req,_res,next)=>{ (req as any).log=logger; next();});
	const spec=loadOpenApi('Gamification Service API');
	app.get('/openapi.json', (_req,res)=>res.json(spec));
	app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
	app.use('/gamification/v1', gamificationRouter);
	app.use(errorHandler);
	return app;
}