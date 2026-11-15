// A whole-document save the API refused (409) because someone saved a newer version first.
export class ConflictError extends Error {
  constructor() {
    super('Changed by someone else');
    this.name = 'ConflictError';
  }
}

export function throwIfConflict(response: Response) {
  if (response.status === 409) throw new ConflictError();
}
