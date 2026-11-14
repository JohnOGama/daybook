import { BaseEdge, type Edge, type EdgeProps, getSmoothStepPath } from '@xyflow/react';
import { memo } from 'react';

export type RelationEdgeData = { fresh: boolean };
export type RelationEdge = Edge<RelationEdgeData, 'relation'>;

// A plain line from the referring column to the column it points at; yellow while the AI's change is new.
function RelationEdgeView({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<RelationEdge>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 6 });
  const fresh = data?.fresh ?? false;
  return <BaseEdge path={path} style={{ stroke: fresh ? 'var(--signal)' : 'var(--muted-foreground)', strokeWidth: fresh ? 1.6 : 1.3, opacity: fresh ? 1 : 0.7 }} />;
}

export const RelationEdgeComponent = memo(RelationEdgeView);
