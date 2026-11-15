'use client';

import { Badge } from '@/shared/components/ui/badge';
import { useSpaceAccess } from '../hooks/useSpaceAccess';

export function ViewOnlyBadgeComponent() {
  const { canEdit } = useSpaceAccess();
  if (canEdit) return null;
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      View only
    </Badge>
  );
}
