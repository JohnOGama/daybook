'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { authClient } from '@/shared/services/auth-client';
import { AuthCardComponent } from './AuthCardComponent';
import { AuthCardSkeletonComponent } from './AuthCardSkeletonComponent';
import { leaveFor } from './oauth-request';

// Anyone can register an app under any name, so the page shows where Allow really sends the code.
// The redirect_uri is part of the signed query, so a changed one fails at /oauth2/consent.
function returnSite(redirectUri: string | null): string | null {
  if (!redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    return url.host || url.protocol.replace(/:$/, '');
  } catch {
    return null;
  }
}

// Better Auth sends a signed-in person here once per app and scope set, during that app's authorization.
export function OAuthConsentPageComponent() {
  const params = useSearchParams();
  const clientId = params.get('client_id') ?? '';
  const site = returnSite(params.get('redirect_uri'));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const client = useQuery({
    queryKey: ['oauth-client', clientId],
    queryFn: async () => {
      const { data, error: lookupError } = await authClient.oauth2.publicClient({ query: { client_id: clientId } });
      if (lookupError) throw lookupError;
      return data;
    },
    enabled: clientId !== '',
    retry: false,
  });

  if (client.isPending && clientId !== '') return <AuthCardSkeletonComponent />;
  const name = (client.data as { client_name?: string } | null | undefined)?.client_name || 'An app';

  async function answer(accept: boolean) {
    setBusy(true);
    setError(undefined);
    const { data, error: consentError } = await authClient.oauth2.consent({ accept });
    const url = (data as { url?: unknown } | null)?.url;
    if (consentError || typeof url !== 'string') {
      setError('Could not finish connecting. Try again from the app.');
      setBusy(false);
      return;
    }
    leaveFor(url);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void answer(true);
  }

  return (
    <AuthCardComponent signedIn title={`Connect ${name}`} error={error} onSubmit={handleSubmit}>
      <p className="text-sm">{name} wants to log food, workouts and weight in your Fitness spaces.</p>
      {site && (
        <p className="text-sm">
          After you allow it, you'll go back to <strong className="font-semibold">{site}</strong>.
        </p>
      )}
      <p className="text-sm text-muted-foreground">You can disconnect it any time in Settings → Connected apps.</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="flex-1">
          Allow
        </Button>
        <Button type="button" variant="outline" disabled={busy} className="flex-1" onClick={() => void answer(false)}>
          Deny
        </Button>
      </div>
    </AuthCardComponent>
  );
}
