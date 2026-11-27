import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, vaultItems, vaults } from '../../../shared/db/schema.ts';
import { createTestDb, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH, AuthGuard } from '../../auth/index.ts';
import { VaultController } from './vault-controller.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { VaultService } from './vault-service.ts';

const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id ? { user: { id } } : null;
    },
  },
};

const b64 = (bytes: number, fill = 1) => Buffer.alloc(bytes, fill).toString('base64');
const material = { salt: b64(16), iterations: 600_000, wrappedKey: b64(60), recoverySalt: b64(16), recoveryWrappedKey: b64(60) };

describe('vault API', () => {
  let app: INestApplication;
  let db: Db;
  let spaceId: string;

  const server = () => request(app.getHttpServer());
  const postVault = (body: object) => server().post('/api/vault').set('x-test-user', 'u1').send(body);
  const postItem = (body: object) => server().post('/api/vault/items').set('x-test-user', 'u1').send(body);
  const item = (fields: object = {}) => ({ id: crypto.randomUUID(), spaceId, iv: b64(12), ciphertext: b64(32), ...fields });

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    const [space] = await db.insert(spaces).values({ userId: 'u1', kind: 'space', title: 'V', tool: 'vault' }).returning();
    spaceId = space.id;
    const moduleRef = await Test.createTestingModule({
      controllers: [VaultController],
      providers: [VaultService, SpaceAccessService, AuthGuard, { provide: DB, useValue: db }, { provide: AUTH, useValue: fakeAuth }],
    }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    app.use(express.json({ limit: '8mb' }));
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => app.close());

  it('answers 401 without a session', async () => {
    await server().get('/api/vault').expect(401);
  });

  it('answers with no vault before one exists', async () => {
    const response = await server().get('/api/vault').set('x-test-user', 'u1').expect(200);
    expect(response.body).toEqual({ vault: null });
  });

  it('answers 409 for a second vault', async () => {
    await postVault(material).expect(201);
    await postVault(material).expect(409);
  });

  it.each([
    ['a salt of 15 bytes', { salt: b64(15) }],
    ['fewer than 600,000 iterations', { iterations: 599_999 }],
    ['a wrapped key that is not 60 bytes', { wrappedKey: b64(59) }],
    ['a recovery salt of 17 bytes', { recoverySalt: b64(17) }],
    ['a recovery wrap that is not 60 bytes', { recoveryWrappedKey: b64(61) }],
    ['something that is not base64', { salt: '!!!not base64!!!' }],
  ])('answers 400 for %s and saves nothing', async (_, change) => {
    await postVault({ ...material, ...change }).expect(400);
    expect(await db.select().from(vaults)).toEqual([]);
  });

  describe('with a vault', () => {
    beforeEach(async () => {
      await postVault(material).expect(201);
    });

    it('saves a valid item', async () => {
      await postItem(item()).expect(201);
      expect(await db.select().from(vaultItems)).toHaveLength(1);
    });

    it.each([
      ['an IV of 11 bytes', { iv: b64(11) }],
      ['ciphertext over 64 KB', { ciphertext: b64(65_537) }],
      ['empty ciphertext', { ciphertext: '' }],
      ['ciphertext that is not base64', { ciphertext: 'not base64 at all' }],
      ['an id that is not a uuid', { id: 'abc' }],
    ])('answers 400 for %s and saves nothing', async (_, change) => {
      await postItem(item(change)).expect(400);
      expect(await db.select().from(vaultItems)).toEqual([]);
    });

    it('answers 400 for more than 2,000 import items and saves nothing', async () => {
      const items = Array.from({ length: 2001 }, () => {
        const { spaceId: _space, ...rest } = item();
        return rest;
      });
      await server().post('/api/vault/items/import').set('x-test-user', 'u1').send({ spaceId, items }).expect(400);
      expect(await db.select().from(vaultItems)).toEqual([]);
    });

    it('erases the vault', async () => {
      await server().delete('/api/vault').set('x-test-user', 'u1').expect(200);
      expect(await db.select().from(vaults)).toEqual([]);
    });
  });
});
