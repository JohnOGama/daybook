'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/shared/services/auth-client';

export function useRedirectIfSignedIn(): { isSignedOut: boolean } {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (session) router.replace('/list');
  }, [session, router]);

  return { isSignedOut: !isPending && !session };
}
