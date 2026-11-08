export function readEnv(names: string[]): Record<string, string> {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name] as string]));
}
