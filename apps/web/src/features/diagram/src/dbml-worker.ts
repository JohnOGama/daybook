import { parseDiagram } from './dbml-model';

// Runs in a Web Worker (see dbml-parse-client.ts): reads DBML off the main thread and answers with the model.
const scope = self as unknown as { addEventListener(type: 'message', listener: (event: MessageEvent<{ id: number; text: string }>) => void): void; postMessage(data: unknown): void };

scope.addEventListener('message', (event) => {
  scope.postMessage({ id: event.data.id, result: parseDiagram(event.data.text) });
});
