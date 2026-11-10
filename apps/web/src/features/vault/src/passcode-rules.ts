import { MIN_PASSCODE_LENGTH } from './vault-crypto';

export function passcodeProblem(passcode: string, repeated: string): string | undefined {
  if (passcode.length < MIN_PASSCODE_LENGTH) return `Use at least ${MIN_PASSCODE_LENGTH} characters.`;
  if (passcode !== repeated) return "Those passcodes don't match.";
  return undefined;
}
