export const PIPELINES_NOTIFIER = Symbol('PIPELINES_NOTIFIER');

// Told after every stored report, so open screens can update.
export type PipelinesNotifier = { changed(spaceId: string): Promise<void> };
