import { Global, Module } from '@nestjs/common';
import { readEnv } from '../utils/read-env.ts';
import { createDb, DB } from './create-db.ts';

@Global()
@Module({
  providers: [{ provide: DB, useFactory: () => createDb(readEnv(['DATABASE_URL']).DATABASE_URL) }],
  exports: [DB],
})
export class DbModule {}
