import { oauthProviderAuthServerMetadata, oauthProviderOpenIdConfigMetadata } from '@better-auth/oauth-provider';
import { toNodeHandler } from 'better-auth/node';
import type express from 'express';
import { type Auth, mcpUrlFor } from '../../auth/index.ts';
import { MCP_SCOPE, oauthIssuer } from './mcp-auth.ts';

export const resourceMetadataUrl = (baseURL: string) => new URL('/.well-known/oauth-protected-resource/api/mcp', baseURL).href;

export const protectedResourceMetadata = (baseURL: string, issuer: string) => ({
  resource: mcpUrlFor(baseURL),
  authorization_servers: [issuer],
  scopes_supported: [MCP_SCOPE],
  bearer_methods_supported: ['header'],
});

// The discovery documents MCP clients read before signing in. They sit at the site root, so the web
// rewrites /.well-known/* to the API. Each is served at its bare path and with a path suffix (RFC 8414 and 9728).
export function mountWellKnown(app: express.Express, auth: Auth): void {
  const baseURL = auth.options.baseURL as string;
  const serverMetadata = toNodeHandler(oauthProviderAuthServerMetadata(auth));
  const openIdMetadata = toNodeHandler(oauthProviderOpenIdConfigMetadata(auth));
  app.get(['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/*rest'], (req, res) => void serverMetadata(req, res));
  app.get(['/.well-known/openid-configuration', '/.well-known/openid-configuration/*rest'], (req, res) => void openIdMetadata(req, res));
  app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/*rest'], async (_req, res) => {
    res.json(protectedResourceMetadata(baseURL, await oauthIssuer(auth)));
  });
}
