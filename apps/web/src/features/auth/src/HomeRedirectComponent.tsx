'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { authClient } from '@/shared/services/auth-client';

export function HomeRedirectComponent() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending) router.replace(session ? '/list' : '/sign-in');
  }, [isPending, session, router]);

  return null;
}
