export type SpaceTool = 'list' | 'notebook' | 'book' | 'vault' | 'budget' | 'fitness' | 'jobs' | 'diagram' | 'pipelines';

// A Pipelines space's sidebar dot: from each job's newest run, failed beats running beats passed; null with no runs.
export type PipelineStatus = 'passed' | 'running' | 'failed';

export type SpaceAccess = 'owner' | 'edit' | 'view';
export type ShareRole = Exclude<SpaceAccess, 'owner'>;
export type Share = { id: string; email: string; role: ShareRole };

export type Space = {
  id: string;
  parentId: string | null;
  kind: 'folder' | 'space';
  title: string;
  tool: SpaceTool | null;
  carryOver: boolean;
  locked: boolean;
  createdAt: string;
  openToday: number;
  access: SpaceAccess;
  shared: boolean;
  ownerId: string;
  ownerName: string | null;
  // Only on Pipelines spaces (null with no runs); optional so other spaces need not carry it.
  pipelines?: PipelineStatus | null;
};

export type CreateSpaceInput =
  | { kind: 'folder'; title: string }
  | { kind: 'space'; title: string; tool: SpaceTool; parentId?: string };

export type NewSpaceInput = CreateSpaceInput & { id: string };

export const TOOLS: { id: SpaceTool; label: string; description: string }[] = [
  { id: 'list', label: 'List', description: 'Plan your days and track tasks' },
  { id: 'notebook', label: 'Notebook', description: 'Write pages with rich text' },
  { id: 'book', label: 'Book', description: 'Write a book chapter by chapter' },
  { id: 'vault', label: 'Vault', description: 'Keep cards, IDs and keys encrypted' },
  { id: 'budget', label: 'Budget', description: 'Track money in, money out and monthly limits' },
  { id: 'fitness', label: 'Fitness', description: 'Track food, training and weight' },
  { id: 'jobs', label: 'Job hunt', description: 'Track the jobs you apply for' },
  { id: 'diagram', label: 'Database diagram', description: 'Design database tables with AI' },
  { id: 'pipelines', label: 'Pipelines', description: 'Track CI/CD runs from Jenkins' },
];
