import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import { AppModule } from './app-module.ts';
import { AUTH } from './features/auth/index.ts';
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
app.getHttpAdapter().getInstance().all('/api/auth/*splat', toNodeHandler(app.get(AUTH)));
app.use('/api/vault/items/import', express.json({ limit: '8mb' }));
app.use(['/api/budget/receipts', '/api/budget/ai/scan-receipt'], express.json({ limit: '8mb' }));
app.use(REPORT_PATH, reportBodyParser());
app.use(express.json({ limit: '2mb' }));
app.setGlobalPrefix('api');
app.get(RealtimeService).attach(app.getHttpServer());
// Lets a stop signal save live diagrams before the process exits.
app.enableShutdownHooks();
await app.listen(PORT);
