const lines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());

// Lines the AI may add: anything about Daybook (the helpers, their calls, DAYBOOK_URL and DAYBOOK_KEY), and the
// bare blocks that hold those calls. Anything else (a stray sh, a `when`, an opening comment) could change what runs.
// ponytail: a line that mentions Daybook passes whole, so `sh 'x' // daybook` would too; parse the Groovy if that matters.
const ALLOWED = [
  /daybook/i,
  /^$/,
  /^[{}]+$/,
  /^(environment|post|success|failure|aborted|always|steps|try)\s*\{\s*\}?$/,
  /^\}\s*catch\s*\(\s*\w+\s*\)\s*\{$/,
];

// Says what is wrong when `result` does more than add Daybook reporting to `original` (null when it only does that).
// Every original line must still be there, unchanged and in order, so the AI can't quietly alter a deploy step;
// every added line must be reporting; the key must come from the Jenkins credential, never be written into the file.
export function addedOnly(original: string, result: string): string | null {
  const before = lines(original);
  const after = lines(result);
  const added: string[] = [];
  let next = 0;
  for (const line of before) {
    while (next < after.length && after[next] !== line) added.push(after[next++]);
    if (next === after.length) return `It changed or removed this line: ${line.trim() || '(a blank line)'}`;
    next++;
  }
  added.push(...after.slice(next));
  const stray = added.find((line) => !ALLOWED.some((pattern) => pattern.test(line.trim())));
  if (stray !== undefined) return `It added a line that is not Daybook reporting: ${stray.trim()}`;
  if (!after.some((line) => line.includes("credentials('DAYBOOK_KEY')"))) return "It did not read the key with credentials('DAYBOOK_KEY')";
  return null;
}
