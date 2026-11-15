'use client';

import { useActiveSpace } from './useActiveSpace';

export function useSpaceAccess() {
  const access = useActiveSpace()?.access ?? 'owner';
  return { access, canEdit: access !== 'view', isOwner: access === 'owner' };
}
