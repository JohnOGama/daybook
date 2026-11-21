'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/shared/services/auth-client';
import { appIsWaiting } from '../src/oauth-request';

// While an app waits for this sign-in, the authorization decides where to go next, not this hook.
export function useRedirectIfSignedIn(enabled = true): { isSignedOut: boolean } {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (enabled && session && !appIsWaiting()) router.replace('/list');
  }, [enabled, session, router]);

  return { isSignedOut: !isPending && !session };
}
