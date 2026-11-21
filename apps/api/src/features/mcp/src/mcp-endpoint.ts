import { Inject, Injectable } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { AUTH, type Auth } from '../../auth/index.ts';
import { FitnessMcpTools } from './fitness-mcp-tools.ts';
import { verifyMcpToken } from './mcp-auth.ts';
import { buildMcpServer } from './mcp-server.ts';
import { resourceMetadataUrl } from './well-known.ts';

export const MCP_PATH = '/api/mcp';
export const mcpBodyParser = () => express.json({ limit: '1mb' });

// POST /api/mcp: Streamable HTTP, stateless, answering in JSON so nothing streams through the Next proxy.
@Injectable()
export class McpEndpoint {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(DB) private readonly db: Db,
    @Inject(FitnessMcpTools) private readonly tools: FitnessMcpTools,
  ) {}

  async handle(req: express.Request, res: express.Response): Promise<void> {
    const caller = await verifyMcpToken(this.auth, this.db, req.headers.authorization);
    if (!caller) {
      // The pointer is how an MCP client finds where to sign in.
      res
        .status(401)
        .set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl(this.auth.options.baseURL as string)}"`)
        .json({ error: 'invalid_token' });
      return;
    }
    const server = buildMcpServer(this.tools, caller.userId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request failed', error);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  }

  notAllowed(_req: express.Request, res: express.Response): void {
    res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  }
}
