import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import meRouter from './routes/me.js';
import { errorHandler, notFound } from './middleware/error.js';

const app: Express = express();
const logger = pino({ enabled: process.env.NODE_ENV !== 'test' });

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});
app.use('/api/me', meRouter);
app.use('/api', (_request, _response, next) => next(notFound('API route not found.')));
app.use(errorHandler);

export default app;
