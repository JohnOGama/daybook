import { Parser } from '@dbml/core';

type Diagnostic = { message?: string; location?: { start?: { line?: number } } };

// null when the text is valid DBML, otherwise its first problem as "Line N: message".
export function dbmlProblem(text: string): string | null {
  try {
    new Parser().parse(text, 'dbmlv2');
    return null;
  } catch (error) {
    const first: Diagnostic = (error as { diags?: Diagnostic[] }).diags?.[0] ?? { message: (error as Error).message };
    return `Line ${first.location?.start?.line ?? 1}: ${first.message ?? 'The diagram could not be read'}`;
  }
}
