const lines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());

// Says what is wrong when `result` does more than add lines to `original` (null when it only adds).
// Every original line must still be there, unchanged and in order, so the AI can't quietly alter a deploy step;
// the key must come from the Jenkins credential, never be written into the file.
export function addedOnly(original: string, result: string): string | null {
  const before = lines(original);
  const after = lines(result);
  let next = 0;
  for (const line of before) {
    while (next < after.length && after[next] !== line) next++;
    if (next === after.length) return `It changed or removed this line: ${line.trim() || '(a blank line)'}`;
    next++;
  }
  if (!after.some((line) => line.includes("credentials('DAYBOOK_KEY')"))) return "It did not read the key with credentials('DAYBOOK_KEY')";
  return null;
}
