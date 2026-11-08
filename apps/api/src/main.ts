import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import express from 'express';
import { AppModule } from './app-module.ts';
import { AUTH } from './features/auth/index.ts';
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
app.use(express.json());
app.setGlobalPrefix('api');
await app.listen(PORT);
