'use client';

import '@xyflow/react/dist/style.css';
import { applyNodeChanges, type FitViewOptions, Background, BackgroundVariant, ControlButton, Controls, type NodeChange, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { JobNodeComponent } from './JobNodeComponent';
import { buildFlow, type PipelineNode } from './pipeline-flow';
import type { PipelineJob } from './pipelines-types';
import { StageNodeComponent } from './StageNodeComponent';

const nodeTypes = { job: JobNodeComponent, stage: StageNodeComponent };

// The corner panel covers the left of the canvas on wide screens, so the fit leaves that strip clear.
const fitOptions = (): FitViewOptions => {
  const left: `${number}px` = window.innerWidth >= 768 ? '320px' : '32px';
  return { maxZoom: 1, padding: { top: '72px', right: '32px', bottom: '72px', left } };
};

type PipelineCanvasProps = { jobs: PipelineJob[]; now: Date; onOpen(runId: string): void };

function Canvas({ jobs, now, onOpen }: PipelineCanvasProps) {
  const flow = useMemo(() => buildFlow(jobs, now), [jobs, now]);
  const { fitView } = useReactFlow();
  const fit = useCallback(() => requestAnimationFrame(() => void fitView(fitOptions())), [fitView]);

  // Local copy so a node follows the pointer. A refresh updates each node's content but keeps where you put it.
  const [nodes, setNodes] = useState<PipelineNode[]>(flow.nodes);
  useEffect(
    () =>
      setNodes((current) => {
        const byId = new Map(current.map((node) => [node.id, node]));
        return flow.nodes.map((node) => {
          const old = byId.get(node.id);
          return old ? ({ ...old, data: node.data } as PipelineNode) : node;
        });
      }),
    [flow],
  );

  // Fit the whole pipeline on screen when it first appears and whenever a job or stage is added or removed.
  const shape = flow.nodes.map((node) => node.id).join('|');
  useEffect(() => {
    fit();
  }, [shape, fit]);

  const tidy = () => {
    setNodes(flow.nodes);
    fit();
  };

  return (
    <ReactFlow<PipelineNode>
      nodes={nodes}
      edges={flow.edges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      minZoom={0.1}
      maxZoom={2}
      nodesConnectable={false}
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
      onNodesChange={(changes: NodeChange<PipelineNode>[]) => setNodes((current) => applyNodeChanges(changes, current))}
      onNodeClick={(_, node) => onOpen(node.data.runId)}
      className="!bg-background"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#262626" />
      <Controls position="bottom-center" orientation="horizontal" showInteractive={false} fitViewOptions={fitOptions()}>
        <ControlButton onClick={tidy} title="Tidy layout" aria-label="Tidy layout">
          <LayoutGrid aria-hidden />
        </ControlButton>
      </Controls>
    </ReactFlow>
  );
}

// The jobs drawn like the diagram tool: drag to pan, scroll or pinch to zoom, drag a node to move it; click one to open its run.
export function PipelineCanvasComponent(props: PipelineCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
