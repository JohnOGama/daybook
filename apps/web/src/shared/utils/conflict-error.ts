// A whole-document save the API refused (409) because someone saved a newer version first.
export class ConflictError extends Error {
  constructor() {
    super('Changed by someone else');
    this.name = 'ConflictError';
  }
}

// The version an open editor's content was edited from, and whether a save of it was refused. The editor owns it;
// a save reads it when the request starts, so a save queued behind another sends the version that one returned.
export type EditedFrom = { version: number; conflicted: boolean };

export function throwIfConflict(response: Response) {
  if (response.status === 409) throw new ConflictError();
}
