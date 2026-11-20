import { expect, it } from 'vitest';
import { skillsFromFolder } from './skill-folder';

const skillMd = (name: string) => `---\nname: ${name}\ndescription: Use when testing ${name}.\n---\n\n# ${name}`;

it('reads a picked skill folder with its files, leaving out binaries and OS junk', () => {
  const { skills, skipped } = skillsFromFolder([
    { path: 'jenkinsfile-setup/SKILL.md', text: skillMd('jenkinsfile-setup') },
    { path: 'jenkinsfile-setup/templates/Jenkinsfile', text: 'pipeline {}' },
    { path: 'jenkinsfile-setup/templates/.dockerignore', text: 'node_modules' },
    { path: 'jenkinsfile-setup/logo.png', text: null },
    { path: 'jenkinsfile-setup/.DS_Store', text: null },
  ]);
  expect(skills).toEqual([
    {
      name: 'jenkinsfile-setup',
      description: 'Use when testing jenkinsfile-setup.',
      body: '# jenkinsfile-setup',
      frontmatter: '',
      files: [
        { path: 'templates/Jenkinsfile', content: 'pipeline {}' },
        { path: 'templates/.dockerignore', content: 'node_modules' },
      ],
    },
  ]);
  expect(skipped).toEqual(['jenkinsfile-setup/logo.png']);
});

it('reads every skill in a picked .claude/skills folder, each keeping only its own files', () => {
  const { skills } = skillsFromFolder([
    { path: 'skills/a/SKILL.md', text: skillMd('a') },
    { path: 'skills/a/ref.md', text: 'a ref' },
    { path: 'skills/a/inner/SKILL.md', text: skillMd('inner') },
    { path: 'skills/a/inner/ref.md', text: 'inner ref' },
    { path: 'skills/b/SKILL.md', text: '# no frontmatter' },
    { path: 'skills/README.md', text: 'not in a skill' },
    { path: 'skills/b/node_modules/x/SKILL.md', text: skillMd('x') },
  ]);
  expect(skills.map(({ name, files }) => [name, files.map(({ path }) => path)])).toEqual([
    ['a', ['ref.md']],
    ['inner', ['ref.md']],
    ['b', []],
  ]);
});

it('finds no skills in a folder without a SKILL.md', () => {
  expect(skillsFromFolder([{ path: 'stuff/notes.md', text: 'x' }])).toEqual({ skills: [], skipped: [] });
});
