import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// oauthProviderClient adds the signed authorization query to sign-in and consent, so they continue to the waiting app.
export const authClient = createAuthClient({ plugins: [emailOTPClient(), oauthProviderClient()] });
