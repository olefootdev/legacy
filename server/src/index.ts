import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { gameSpiritRoutes } from './routes/gameSpirit.js';
import { healthRoutes } from './routes/health.js';
import { matchRoutes } from './routes/matches.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.route('/', healthRoutes);
app.route('/', matchRoutes);
app.route('/', gameSpiritRoutes);

const port = Number(process.env.PORT) || 4000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`[olefoot-server] listening on http://localhost:${port}`);
});
