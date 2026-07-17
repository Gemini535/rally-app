import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';

const app: Express = express();
const logger = pino({ enabled: process.env.NODE_ENV !== 'test' });

app.disable('x-powered-by');
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

export default app;
