import { describe, expect, it } from 'vitest';
import { JENKINS_HELPER } from '../../budget/src/jenkins-helper.ts';
import { addedOnly } from './added-only.ts';

const ORIGINAL = `pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'pnpm test'
      }
    }
  }
}`;
const WITH_REPORTING = `def daybook(String stage, String status, String message = '') { }
pipeline {
  agent any
  environment {
    DAYBOOK_KEY = credentials('DAYBOOK_KEY')
  }
  stages {
    stage('Test') {
      steps {
        daybook('Test', 'started')
        sh 'pnpm test'
      }
      post { success { daybook('Test', 'passed') } }
    }
  }
}`;

describe('addedOnly', () => {
  it('accepts pure additions', () => {
    expect(addedOnly(ORIGINAL, WITH_REPORTING)).toBeNull();
  });

  it('refuses a changed line and a removed line, naming the line', () => {
    expect(addedOnly(ORIGINAL, WITH_REPORTING.replace("sh 'pnpm test'", "sh 'pnpm test --bail'"))).toContain("sh 'pnpm test'");
    expect(addedOnly(ORIGINAL, WITH_REPORTING.replace("        sh 'pnpm test'\n", ''))).toContain("sh 'pnpm test'");
  });

  it('refuses lines that moved out of order', () => {
    const swapped = WITH_REPORTING.replace('  agent any\n', '').replace('  stages {', '  stages {\n  agent any');
    expect(addedOnly(ORIGINAL, swapped)).not.toBeNull();
  });

  it('ignores blank lines and the newline at the end of a pasted file', () => {
    expect(addedOnly(`${ORIGINAL}\n`, WITH_REPORTING)).toBeNull();
    expect(addedOnly(`\n${ORIGINAL.replace('  stages {', '\n  stages {')}\n\n`, WITH_REPORTING)).toBeNull();
    expect(addedOnly(ORIGINAL, WITH_REPORTING.replace('  stages {', '\n\n  stages {'))).toBeNull();
  });

  it('ignores CRLF and trailing spaces', () => {
    expect(addedOnly(ORIGINAL.replaceAll('\n', '\r\n').replace('agent any', 'agent any   '), WITH_REPORTING)).toBeNull();
    expect(addedOnly(ORIGINAL, WITH_REPORTING.replaceAll('\n', '\r\n'))).toBeNull();
  });

  it('refuses added lines that are not Daybook reporting', () => {
    const add = (line: string) => WITH_REPORTING.replace("        daybook('Test', 'started')", `        daybook('Test', 'started')\n${line}`);
    expect(addedOnly(ORIGINAL, add("        sh 'rm -rf /'"))).toContain("sh 'rm -rf /'");
    expect(addedOnly(ORIGINAL, add('      when { expression { false } }'))).toContain('when');
    expect(addedOnly(ORIGINAL, add('/*'))).toContain('/*');
  });

  it('accepts every line of the real helper, as the AI adds it', () => {
    expect(addedOnly(ORIGINAL, `${JENKINS_HELPER}\n${WITH_REPORTING}`)).toBeNull();
  });

  it("accepts the helper's own lines and the post blocks", () => {
    const helper = [
      "def daybook(String stage, String status, String message = '') {",
      '  try {',
      '    def file = ".daybook-${stage.replaceAll(\'[^A-Za-z0-9_-]\', \'_\')}.json"',
      '  } catch (e) {',
      '    echo "Daybook report skipped: ${e}"',
      '  }',
      '}',
      '',
    ].join('\n');
    const withPost = `${helper}${WITH_REPORTING}`.replace(
      '  stages {',
      "  post {\n    success { daybookFinish('passed') }\n    aborted { daybookFinish('aborted') }\n  }\n  stages {",
    );
    expect(addedOnly(ORIGINAL, withPost)).toBeNull();
  });

  it("refuses an answer without credentials('DAYBOOK_KEY')", () => {
    expect(addedOnly(ORIGINAL, WITH_REPORTING.replace("credentials('DAYBOOK_KEY')", "'dbk_hardcoded'"))).toMatch(/credentials/);
  });
});
