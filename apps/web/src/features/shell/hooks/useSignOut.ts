'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authClient } from '@/shared/services/auth-client';

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    await authClient.signOut();
    queryClient.clear();
    router.push('/sign-in');
  };
}
