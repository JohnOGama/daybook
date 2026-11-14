'use client';

import { useQuery } from '@tanstack/react-query';
import { useActiveSpace } from '@/features/spaces';
import { fetchDiagram } from '../src/diagram-api';

export function useDiagramSpaceId(): string | undefined {
  const space = useActiveSpace();
  return space?.tool === 'diagram' ? space.id : undefined;
}

export function useDiagram() {
  const spaceId = useDiagramSpaceId();
  return useQuery({ queryKey: ['diagram', spaceId], queryFn: () => fetchDiagram(spaceId as string), enabled: Boolean(spaceId) });
}
