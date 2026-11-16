const split = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');

// The result's lines, each marked when the AI added it. The server already checked that every pasted line is still
// there in order, so walking both in step is enough (line endings and trailing spaces don't count as changes).
// Blank lines are skipped on both sides, as the server's check does: they never count as added.
export function markAdded(original: string, result: string): { text: string; added: boolean }[] {
  const before = split(original)
    .map((line) => line.trimEnd())
    .filter((line) => line !== '');
  let next = 0;
  return split(result).map((text) => {
    if (text.trim() === '') return { text, added: false };
    if (next < before.length && text.trimEnd() === before[next]) {
      next++;
      return { text, added: false };
    }
    return { text, added: true };
  });
}

// What the AI adds, for anyone adding it by hand. `daybookUrl` is the address Jenkins reports to.
// Kept word for word in step with JENKINS_HELPER in the API's features/budget/src/jenkins-helper.ts:
// one file per stage (parallel stages can't swap reports), and try/catch so it never fails the build.
export function helperSnippet(daybookUrl: string): string {
  const send = (file: string) =>
    `    sh label: 'Report to Daybook', script: "curl -sS -m 5 -X POST \\"\\$DAYBOOK_URL/api/pipelines/report\\" -H \\"Authorization: Bearer \\$DAYBOOK_KEY\\" -H 'Content-Type: application/json' --data @${file} || true"`;
  return [
    '// Reports to Daybook. It never fails the build: 5 s timeout, every error caught.',
    "def daybook(String stage, String status, String message = '') {",
    '  try {',
    '    def file = ".daybook-${stage.replaceAll(\'[^A-Za-z0-9_-]\', \'_\')}.json"',
    '    writeFile file: file, text: groovy.json.JsonOutput.toJson([job: env.JOB_NAME, run: env.BUILD_NUMBER, url: env.BUILD_URL, stage: stage, status: status, message: message])',
    send('${file}'),
    '  } catch (e) {',
    '    echo "Daybook report skipped: ${e}"',
    '  }',
    '}',
    'def daybookFinish(String status) {',
    '  try {',
    "    writeFile file: '.daybook-run.json', text: groovy.json.JsonOutput.toJson([job: env.JOB_NAME, run: env.BUILD_NUMBER, url: env.BUILD_URL, status: status])",
    send('.daybook-run.json'),
    '  } catch (e) {',
    '    echo "Daybook report skipped: ${e}"',
    '  }',
    '}',
    '',
    '// Inside pipeline { … }:',
    'environment {',
    `  DAYBOOK_URL = '${daybookUrl}'`,
    "  DAYBOOK_KEY = credentials('DAYBOOK_KEY')",
    '}',
    "// In each stage: daybook('Test', 'started') first in steps, and",
    "// post { success { daybook('Test', 'passed') } failure { daybook('Test', 'failed', 'Test failed, see Jenkins') } }",
    "// At the end of pipeline: post { success { daybookFinish('passed') } failure { daybookFinish('failed') } aborted { daybookFinish('aborted') } }",
  ].join('\n');
}
