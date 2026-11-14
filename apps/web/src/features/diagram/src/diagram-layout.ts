import dagre from '@dagrejs/dagre';
import type { DiagramModel, Point, Positions, Table } from './diagram-types';

export const TABLE_WIDTH = 220;
export const ROW_HEIGHT = 26;
export const HEADER_HEIGHT = 34;
const GAP = 80;

export const tableHeight = (table: Table) => HEADER_HEIGHT + Math.max(table.columns.length, 1) * ROW_HEIGHT;

// Left to right, referred tables before the tables that point at them. Positions are each card's top-left corner.
function layout({ tables, refs }: DiagramModel): Positions {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: GAP });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const table of tables) graph.setNode(table.name, { width: TABLE_WIDTH, height: tableHeight(table) });
  for (const { from, to } of refs) {
    if (from.table !== to.table && graph.hasNode(from.table) && graph.hasNode(to.table)) graph.setEdge(to.table, from.table);
  }
  dagre.layout(graph);
  return Object.fromEntries(
    tables.map((table) => {
      const node = graph.node(table.name);
      return [table.name, { x: Math.round(node.x - TABLE_WIDTH / 2), y: Math.round(node.y - tableHeight(table) / 2) }];
    }),
  );
}

export const tidyLayout = (model: DiagramModel): Positions => (model.tables.length === 0 ? {} : layout(model));

// Keeps where the owner put each table, forgets tables that are gone, and lays out new ones to the right of the rest.
export function placeTables(model: DiagramModel, positions: Positions): Positions {
  const names = new Set(model.tables.map(({ name }) => name));
  const kept = Object.entries(positions).filter(([name]) => names.has(name));
  const missing = model.tables.filter(({ name }) => !(name in positions));
  if (missing.length === 0) return kept.length === Object.keys(positions).length ? positions : Object.fromEntries(kept);

  const missingNames = new Set(missing.map(({ name }) => name));
  const fresh = layout({ tables: missing, refs: model.refs.filter(({ from, to }) => missingNames.has(from.table) && missingNames.has(to.table)) });
  const points = Object.values(fresh);
  const origin: Point = { x: Math.min(...points.map(({ x }) => x)), y: Math.min(...points.map(({ y }) => y)) };
  const start: Point = kept.length === 0 ? { x: 0, y: 0 } : { x: Math.max(...kept.map(([, { x }]) => x)) + TABLE_WIDTH + GAP, y: Math.min(...kept.map(([, { y }]) => y)) };
  const shifted = Object.fromEntries(Object.entries(fresh).map(([name, { x, y }]) => [name, { x: x - origin.x + start.x, y: y - origin.y + start.y }]));
  return { ...Object.fromEntries(kept), ...shifted };
}
