import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import { AppModule } from './app-module.ts';
import { AUTH } from './features/auth/index.ts';
import { MCP_PATH, McpEndpoint, mcpBodyParser, mountWellKnown } from './features/mcp/index.ts';
import { REPORT_PATH, reportBodyParser } from './features/pipelines/index.ts';
import { RealtimeService } from './features/realtime/index.ts';
import { readEnv } from './shared/utils/read-env.ts';

const { PORT } = readEnv([
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'PORT',
]);

const app = await NestFactory.create(AppModule, { bodyParser: false });
const http = app.getHttpAdapter().getInstance() as express.Express;
http.all('/api/auth/*splat', toNodeHandler(app.get(AUTH)));
mountWellKnown(http, app.get(AUTH));
// AI apps call this with a bearer token from Daybook's OAuth provider instead of the session cookie.
app.use(MCP_PATH, mcpBodyParser());
http.post(MCP_PATH, (req, res) => app.get(McpEndpoint).handle(req, res));
http.all(MCP_PATH, (req, res) => app.get(McpEndpoint).notAllowed(req, res));
app.use('/api/vault/items/import', express.json({ limit: '8mb' }));
app.use(['/api/budget/receipts', '/api/budget/ai/scan-receipt'], express.json({ limit: '8mb' }));
app.use(REPORT_PATH, reportBodyParser());
app.use(express.json({ limit: '2mb' }));
app.setGlobalPrefix('api');
app.get(RealtimeService).attach(app.getHttpServer());
// Lets a stop signal save live diagrams before the process exits.
app.enableShutdownHooks();
await app.listen(PORT);
