import { describe, expect, it } from 'vitest';
import { parseSkillMd, skillHints, skillOf, toSkillMd, toSkillName } from './skill-md';

const good = { name: 'deploy-checklist', description: 'Use when deploying Daybook to production or shipping a release.', body: '# Deploy\n\n1. Migrate.' };

describe('skill-md', () => {
  it('reads a skill from a page, and an empty one from a new page', () => {
    const files = [{ path: 'templates/a', content: 'x' }];
    expect(skillOf({ title: 'x', content: { type: 'skill', description: 'd', body: 'b', frontmatter: 'model: opus', files } })).toEqual({
      name: 'x',
      description: 'd',
      body: 'b',
      frontmatter: 'model: opus',
      files,
    });
    expect(skillOf({ title: '', content: null })).toEqual({ name: '', description: '', body: '', frontmatter: '', files: [] });
  });

  it.each([
    ['plain', 'description: Use when: deploying', 'Use when: deploying'],
    ['double quoted', 'description: "Use when \\"shipping\\" — now"', 'Use when "shipping" — now'],
    ['single quoted', "description: 'It''s for deploys'", "It's for deploys"],
    ['folded block', 'description: >\n  Use when deploying\n  to production', 'Use when deploying to production'],
    ['plain over two lines', 'description: Use when deploying\n  to production', 'Use when deploying to production'],
  ])('reads a %s description', (_, line, description) => {
    expect(parseSkillMd(`---\nname: deploy\n${line}\n---\n# Body`).description).toBe(description);
  });

  it('keeps other frontmatter keys word for word and reads Windows line endings', () => {
    const parsed = parseSkillMd('﻿---\r\nname: jenkinsfile-setup\r\nallowed-tools:\r\n  - Read\r\ndescription: Use when setting up CI.\r\nmodel: opus\r\n---\r\n\r\n# Jenkinsfile Setup\r\n');
    expect(parsed).toEqual({ name: 'jenkinsfile-setup', description: 'Use when setting up CI.', body: '# Jenkinsfile Setup', frontmatter: 'allowed-tools:\n  - Read\nmodel: opus' });
    expect(toSkillMd(parsed)).toBe('---\nname: jenkinsfile-setup\ndescription: "Use when setting up CI."\nallowed-tools:\n  - Read\nmodel: opus\n---\n\n# Jenkinsfile Setup\n');
  });

  it('treats a file with no frontmatter as all body', () => {
    expect(parseSkillMd('# Just steps')).toEqual({ name: '', description: '', body: '# Just steps', frontmatter: '' });
  });

  it('writes SKILL.md with frontmatter that survives colons and quotes', () => {
    const md = toSkillMd({ ...good, description: 'Use when: shipping "v2"\nnow' });
    expect(md).toBe('---\nname: deploy-checklist\ndescription: "Use when: shipping \\"v2\\" now"\n---\n\n# Deploy\n\n1. Migrate.\n');
    expect(toSkillMd({ name: '', description: '', body: '  ' })).toBe('---\nname: untitled-skill\ndescription: ""\n---\n');
  });

  it('turns typed names into skill names', () => {
    expect(toSkillName('Deploy Check_list')).toBe('deploy-check-list');
  });

  it('hints at names and descriptions Claude would struggle with', () => {
    expect(skillHints(good)).toEqual({});
    expect(skillHints({ ...good, name: '', description: '' })).toEqual({ name: expect.stringContaining('folder'), description: expect.stringContaining('when') });
    expect(skillHints({ ...good, name: 'bad--name', description: 'Deploy stuff' }).name).toContain('lowercase');
    expect(skillHints({ ...good, description: 'Deploy stuff' }).description).toContain('Too short');
    expect(skillHints({ ...good, description: 'x'.repeat(1025) }).description).toContain('1025');
  });
});
