// The Groovy helpers the AI adds before `pipeline {`. Kept word for word in step with `helperSnippet` in the web's
// features/pipelines/src/jenkinsfile-lines.ts, which shows the same lines for adding by hand.
// - One JSON file per stage, so parallel stages can't send each other's report.
// - Everything inside try/catch, so a missing workspace, no `sh` (Windows) or an unapproved call never fails the build.
// - The key stays in the shell's environment ($DAYBOOK_KEY), never in a Groovy string.
const send = (file: string) =>
  `    sh label: 'Report to Daybook', script: "curl -sS -m 5 -X POST \\"\\$DAYBOOK_URL/api/pipelines/report\\" -H \\"Authorization: Bearer \\$DAYBOOK_KEY\\" -H 'Content-Type: application/json' --data @${file} || true"`;

export const JENKINS_HELPER = [
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
].join('\n');
