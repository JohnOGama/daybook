import { expect, it, vi } from 'vitest';
import { createDb } from './create-db.ts';

it('survives an idle connection error', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const db = createDb('postgres://user:pass@127.0.0.1:1/db') as unknown as {
    $client: { emit(event: string, error: Error): void; end(): Promise<void> };
  };
  expect(() => db.$client.emit('error', new Error('connection lost'))).not.toThrow();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
  await db.$client.end();
});
