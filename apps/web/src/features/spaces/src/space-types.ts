export type SpaceTool = 'list' | 'notebook';

export type Space = {
  id: string;
  parentId: string | null;
  kind: 'folder' | 'space';
  title: string;
  tool: SpaceTool | null;
  carryOver: boolean;
  createdAt: string;
  openToday: number;
};

export type CreateSpaceInput =
  | { kind: 'folder'; title: string }
  | { kind: 'space'; title: string; tool: SpaceTool; parentId?: string };

export type NewSpaceInput = CreateSpaceInput & { id: string };

export const TOOLS: { id: SpaceTool; label: string; description: string }[] = [
  { id: 'list', label: 'List', description: 'Plan your days and track tasks' },
  { id: 'notebook', label: 'Notebook', description: 'Write pages with rich text' },
];
