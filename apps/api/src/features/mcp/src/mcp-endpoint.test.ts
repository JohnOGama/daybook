import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { fitnessWeights } from '../../../shared/db/schema.ts';
import { insertSpace } from '../../../shared/db/test-db.ts';
import type { Auth } from '../../auth/index.ts';
import { runOAuthFlow, testAuth } from '../../auth/src/oauth-test-flow.ts';
import { FitnessFoodService, FitnessService, FitnessWorkoutService } from '../../fitness/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { FitnessMcpTools } from './fitness-mcp-tools.ts';
import { MCP_PATH, McpEndpoint, mcpBodyParser } from './mcp-endpoint.ts';

const TOOLS = ['get_day', 'list_fitness_spaces', 'log_food', 'log_weight', 'log_workout', 'remove_food_log', 'remove_workout', 'search_exercises', 'search_foods'];

describe('McpEndpoint', () => {
  let auth: Auth;
  let db: Db;
  let otps: Map<string, string>;
  let app: express.Express;
  let server: Server;
  let url: URL;
  let clients: Client[];

  beforeEach(async () => {
    ({ auth, db, otps } = await testAuth());
    const fitness = new FitnessService(db);
    const tools = new FitnessMcpTools(db, new SpaceAccessService(db), new SpaceLockService(db), fitness, new FitnessFoodService(db, fitness), new FitnessWorkoutService(db, fitness));
    const endpoint = new McpEndpoint(auth, db, tools);
    app = express();
    app.use(MCP_PATH, mcpBodyParser());
    app.post(MCP_PATH, (req, res) => endpoint.handle(req, res));
    app.all(MCP_PATH, (req, res) => endpoint.notAllowed(req, res));
    server = app.listen(0);
    url = new URL(MCP_PATH, `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    clients = [];
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
    server.close();
  });

  async function connect(token: string) {
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    clients.push(client);
    return client;
  }

  const text = (result: Awaited<ReturnType<Client['callTool']>>) => (result.content as { text: string }[])[0].text;

  it('answers 401 with the resource metadata pointer when there is no token', async () => {
    const response = await request(app).post(MCP_PATH).send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/api/mcp"');
  });

  it('lists the nine Fitness tools to a connected app', async () => {
    const { accessToken } = await runOAuthFlow(auth, otps);
    const client = await connect(accessToken);
    expect((await client.listTools()).tools.map(({ name }) => name).sort()).toEqual(TOOLS);
  });

  it('logs a weigh-in through a tool call', async () => {
    const { accessToken, userId } = await runOAuthFlow(auth, otps);
    await insertSpace(db, userId, { tool: 'fitness', title: 'Home' });
    const client = await connect(accessToken);
    const result = await client.callTool({ name: 'log_weight', arguments: { day: '2026-11-21', kg: 80 } });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(text(result))).toEqual({ day: '2026-11-21', kg: 80 });
    expect(await db.select().from(fitnessWeights)).toMatchObject([{ userId, day: '2026-11-21', weightG: 80_000 }]);
  });

  it('returns tool problems as tool errors, not HTTP errors', async () => {
    const { accessToken } = await runOAuthFlow(auth, otps);
    const client = await connect(accessToken);
    const result = await client.callTool({ name: 'log_weight', arguments: { day: '2026-11-21', kg: 80 } });
    expect(result.isError).toBe(true);
    expect(text(result)).toBe("There's no Fitness space you can edit. Create one in Daybook first.");
  });

  it('refuses a malformed day before running the tool', async () => {
    const { accessToken, userId } = await runOAuthFlow(auth, otps);
    await insertSpace(db, userId, { tool: 'fitness', title: 'Home' });
    const client = await connect(accessToken);
    const result = await client.callTool({ name: 'log_weight', arguments: { day: '21/11/2026', kg: 80 } });
    expect(result.isError).toBe(true);
    expect(await db.select().from(fitnessWeights)).toEqual([]);
  });

  it('answers 405 to GET', async () => {
    expect((await request(app).get(MCP_PATH)).status).toBe(405);
  });

  it('refuses a body over 1 MB with 413', async () => {
    const { accessToken } = await runOAuthFlow(auth, otps);
    const response = await request(app)
      .post(MCP_PATH)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', padding: 'x'.repeat(1_100_000) }));
    expect(response.status).toBe(413);
  });
});
