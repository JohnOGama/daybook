'use client';

import '@xyflow/react/dist/style.css';
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  type NodeChange,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  ViewportPortal,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import { LayoutGrid, Maximize, Minus, PanelLeftOpen, Plus } from 'lucide-react';
import { type ReactNode, type Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useSpacePresence } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { TABLE_WIDTH, tableHeight } from './diagram-layout';
import type { ColumnRef, DiagramModel, Point, Positions } from './diagram-types';
import { type RelationEdge, RelationEdgeComponent } from './RelationEdgeComponent';
import { RemoteCursorsComponent } from './RemoteCursorsComponent';
import { handleId, type TableNode, TableNodeComponent } from './TableNodeComponent';

export type CanvasHandle = { fitView(): void; toImage(kind: 'png' | 'svg'): Promise<string> };

type DiagramCanvasProps = {
  model: DiagramModel;
  positions: Positions;
  fresh: Set<string>;
  selected: string | null;
  onSelect(table: string | null): void;
  onMove(table: string, position: Point): void;
  onTidy?: () => void;
  readOnly?: boolean;
  // Given only while the code panel is hidden; shows a button at the start of the toolbar to bring it back.
  onShowCode?: () => void;
  ref?: Ref<CanvasHandle>;
};

const nodeTypes = { table: TableNodeComponent };
const edgeTypes = { relation: RelationEdgeComponent };
const IMAGE_PADDING = 40;
const ORIGIN: Point = { x: 0, y: 0 };
const NO_LINKS: Record<string, ColumnRef> = {};

function Control({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className="size-8" onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Controls({ onTidy, onShowCode }: { onTidy?: () => void; onShowCode?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="top-left" className="flex items-center gap-0.5 rounded-lg border bg-popover p-0.5 shadow-lg">
      {onShowCode && (
        <>
          <Control label="Show code" onClick={onShowCode}>
            <PanelLeftOpen aria-hidden />
          </Control>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
        </>
      )}
      <Control label="Zoom out" onClick={() => zoomOut()}>
        <Minus aria-hidden />
      </Control>
      <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
      <Control label="Zoom in" onClick={() => zoomIn()}>
        <Plus aria-hidden />
      </Control>
      <Control label="Fit to screen" onClick={() => fitView({ padding: 0.15 })}>
        <Maximize aria-hidden />
      </Control>
      {onTidy && (
        <Control label="Tidy layout" onClick={onTidy}>
          <LayoutGrid aria-hidden />
        </Control>
      )}
    </Panel>
  );
}

function Canvas({ model, positions, fresh, selected, onSelect, onMove, onTidy, onShowCode, readOnly = false, ref }: DiagramCanvasProps) {
  const flow = useReactFlow<TableNode, RelationEdge>();
  const wrapper = useRef<HTMLDivElement>(null);
  const presence = useSpacePresence();
  const cursorSent = useRef(0);

  // Each card keeps the same node object until its own table, links, position or selection changes,
  // so React Flow only redraws the cards that changed (a click redraws two cards, not all of them).
  const nodeCache = useRef(new Map<string, { key: string; node: TableNode }>());
  const derived = useMemo<TableNode[]>(() => {
    const pointsTo: Record<string, Record<string, ColumnRef>> = {};
    for (const { from, to } of model.refs) (pointsTo[from.table] ??= {})[from.column] = to;
    const cache = new Map<string, { key: string; node: TableNode }>();
    const nodes = model.tables.map((table) => {
      const position = positions[table.name] ?? ORIGIN;
      const links = pointsTo[table.name] ?? NO_LINKS;
      const isFresh = fresh.has(table.name);
      const isSelected = selected === table.name;
      const key = JSON.stringify([table, links, isFresh, isSelected, position.x, position.y]);
      const cached = nodeCache.current.get(table.name);
      const node: TableNode =
        cached?.key === key
          ? cached.node
          : { id: table.name, type: 'table', position, width: TABLE_WIDTH, height: tableHeight(table), data: { table, fresh: isFresh, pointsTo: links }, selected: isSelected };
      cache.set(table.name, { key, node });
      return node;
    });
    nodeCache.current = cache;
    return nodes;
  }, [model, positions, fresh, selected]);

  // Local copy so a table follows the pointer while dragged. The parent hears about the drag every 50 ms (so others
  // watch it move) and when it ends; the dragged card keeps its local position so those updates can't pull it back.
  const [nodes, setNodes] = useState(derived);
  const dragging = useRef<string | null>(null);
  const lastSent = useRef(0);
  useEffect(
    () => setNodes((current) => (dragging.current ? derived.map((node) => (node.id === dragging.current ? (current.find(({ id }) => id === node.id) ?? node) : node)) : derived)),
    [derived],
  );
  const report = (id: string, position: Point) => onMove(id, { x: Math.round(position.x), y: Math.round(position.y) });

  // The view is fitted on mount, when the diagram may still be empty; fit again once the first tables appear.
  const hadTables = useRef(derived.length > 0);
  useEffect(() => {
    if (derived.length === 0 || hadTables.current) return;
    hadTables.current = true;
    requestAnimationFrame(() => void flow.fitView({ padding: 0.15 }));
  }, [derived.length, flow]);

  const edges = useMemo<RelationEdge[]>(
    () =>
      model.refs.map((ref, index) => {
        const from = positions[ref.from.table]?.x ?? 0;
        const to = positions[ref.to.table]?.x ?? 0;
        const same = ref.from.table === ref.to.table;
        const [sourceSide, targetSide] = same ? (['r', 'r'] as const) : from <= to ? (['r', 'l'] as const) : (['l', 'r'] as const);
        return {
          id: `ref-${index}`,
          type: 'relation',
          source: ref.from.table,
          target: ref.to.table,
          sourceHandle: handleId('s', sourceSide, ref.from.column),
          targetHandle: handleId('t', targetSide, ref.to.column),
          data: { fresh: fresh.has(ref.from.table) || fresh.has(ref.to.table) },
        };
      }),
    [model.refs, positions, fresh],
  );

  useImperativeHandle(ref, () => ({
    fitView: () => void flow.fitView({ padding: 0.15 }),
    // The whole diagram, not only what is on screen, on the app's dark background.
    toImage: async (kind) => {
      const viewport = wrapper.current?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewport) throw new Error('The diagram is not ready yet.');
      const bounds = getNodesBounds(flow.getNodes());
      const width = Math.ceil(bounds.width + IMAGE_PADDING * 2);
      const height = Math.ceil(bounds.height + IMAGE_PADDING * 2);
      const view = getViewportForBounds(bounds, width, height, 1, 1, 0);
      const options = {
        backgroundColor: '#000000',
        width,
        height,
        style: { width: `${width}px`, height: `${height}px`, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` },
      };
      return kind === 'png' ? toPng(viewport, { ...options, pixelRatio: 2 }) : toSvg(viewport, options);
    },
  }));

  return (
    <div
      ref={wrapper}
      className="@container size-full"
      // Your pointer, in diagram coordinates, for everyone else's canvas (at most every 50 ms).
      onPointerMove={(event) => {
        if (!presence || Date.now() - cursorSent.current < 50) return;
        cursorSent.current = Date.now();
        presence.awareness.setLocalStateField('cursor', flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      }}
      onPointerLeave={() => presence?.awareness.setLocalStateField('cursor', null)}
    >
      <ReactFlow<TableNode, RelationEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2}
        nodesConnectable={false}
        nodesDraggable={!readOnly}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        onNodesChange={(changes: NodeChange<TableNode>[]) => setNodes((current) => applyNodeChanges(changes, current))}
        onNodeDragStart={(_, node) => {
          dragging.current = node.id;
        }}
        onNodeDrag={(_, node) => {
          if (Date.now() - lastSent.current < 50) return;
          lastSent.current = Date.now();
          report(node.id, node.position);
        }}
        onNodeDragStop={(_, node) => {
          dragging.current = null;
          report(node.id, node.position);
        }}
        onNodeClick={(_, node) => onSelect(node.id)}
        onPaneClick={() => onSelect(null)}
        className="!bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#262626" />
        {presence && (
          <ViewportPortal>
            <RemoteCursorsComponent awareness={presence.awareness} members={presence.members} />
          </ViewportPortal>
        )}
        <Controls onTidy={onTidy} onShowCode={onShowCode} />
        {/* Top-right: the app's Assistant button sits in the bottom-right corner. */}
        {nodes.length > 0 && (
          <MiniMap pannable zoomable position="top-right" className="hidden !rounded-lg !border !bg-popover @2xl:block" maskColor="rgb(0 0 0 / 0.6)" nodeColor="#333" />
        )}
      </ReactFlow>
    </div>
  );
}

// The diagram drawn from the model: drag to pan, scroll or pinch to zoom, drag tables to arrange them.
export function DiagramCanvasComponent(props: DiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
