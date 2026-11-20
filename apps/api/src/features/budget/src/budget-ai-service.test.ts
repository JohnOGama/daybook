import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BudgetAiService } from './budget-ai-service.ts';

const categories = [
  { id: 'food', name: 'Food' },
  { id: 'transport', name: 'Transport' },
];

// Stands in for Gemini: replies with the given text.
function withReply(text: string) {
  const service = new BudgetAiService();
  const generateContent = vi.fn(async (_request: unknown) => ({ text }));
  Object.assign(service, { client: { models: { generateContent } } });
  return { service, generateContent };
}

describe('BudgetAiService', () => {
  it('is off without a Gemini key and says how to turn it on', async () => {
    const service = new BudgetAiService();
    expect(service.enabled).toBe(process.env.GEMINI_API_KEY !== undefined && process.env.GEMINI_API_KEY !== '');
    Object.assign(service, { client: null });
    await expect(service.categorize(categories, { note: 'Bus', kind: 'expense', amount: '$2' })).rejects.toThrow(ServiceUnavailableException);
  });

  it('maps the chosen category name back to its id, and NONE to no category', async () => {
    expect(await withReply('{"category":"Transport"}').service.categorize(categories, { note: 'Bus', kind: 'expense', amount: '$2' })).toBe('transport');
    expect(await withReply('{"category":"NONE"}').service.categorize(categories, { note: 'Gift', kind: 'expense', amount: '$2' })).toBeNull();
  });

  it('rewrites a passage into one plain paragraph and refuses an empty reply', async () => {
    const { service, generateContent } = withReply('{"text":" The rain had stopped.\\n\\nShe went out. "}');
    expect(await service.rewrite('rain stopped. she went out', 'Improve the writing.')).toBe('The rain had stopped. She went out.');
    expect(JSON.stringify(generateContent.mock.calls[0][0])).toContain('rain stopped. she went out');
    await expect(withReply('{"text":"  "}').service.rewrite('x', 'Improve the writing.')).rejects.toThrow(BadGatewayException);
  });

  it('writes a fitness read from summary figures, trimmed to five points, and refuses a reply without points', async () => {
    const points = Array.from({ length: 7 }, (_, index) => `Point ${index}`);
    const { service, generateContent } = withReply(JSON.stringify({ headline: 'On track', points }));
    expect(await service.fitnessRead({ currentWeightKg: 80 })).toEqual({ headline: 'On track', points: points.slice(0, 5) });
    const request = JSON.stringify(generateContent.mock.calls[0][0]);
    expect(request).toContain('currentWeightKg');
    expect(request).toContain('Do not diagnose');
    await expect(withReply('{"headline":"No points"}').service.fitnessRead({})).rejects.toThrow(BadGatewayException);
  });

  it('improves a skill, joining body lines and keeping the old name when the new one breaks the rules', async () => {
    const reply = { name: 'Deploy Checklist!', description: ' Use when deploying. ', bodyLines: ['# Deploy', '', '1. Migrate.'], purpose: 'Ships a release.', changes: ['a', ' ', 'b'] };
    const { service, generateContent } = withReply(JSON.stringify(reply));
    const skill = { name: 'deploy-checklist', description: 'Deploy stuff', body: 'run migrations' };
    expect(await service.improveSkill(skill, 'Shorter')).toEqual({
      name: 'deploy-checklist',
      description: 'Use when deploying.',
      body: '# Deploy\n\n1. Migrate.',
      purpose: 'Ships a release.',
      changes: ['a', 'b'],
    });
    const request = JSON.stringify(generateContent.mock.calls[0][0]);
    expect(request).toContain('run migrations');
    expect(request).toContain('<instruction>\\nShorter');
    const withFiles = withReply(JSON.stringify(reply));
    await withFiles.service.improveSkill({ ...skill, files: ['templates/Jenkinsfile'] });
    expect(JSON.stringify(withFiles.generateContent.mock.calls[0][0])).toContain('<other-files>\\ntemplates/Jenkinsfile');
    expect((await withReply(JSON.stringify({ ...reply, name: 'deploy-v2' })).service.improveSkill(skill)).name).toBe('deploy-v2');
  });

  it('refuses a reply that does not fit the schema instead of using it', async () => {
    const { service } = withReply('{"category":"Rent"}');
    await expect(service.categorize(categories, { note: 'Flat', kind: 'expense', amount: '$900' })).rejects.toThrow(BadGatewayException);
    await expect(withReply('not json').service.insights({ month: '2026-11' })).rejects.toThrow(BadGatewayException);
  });

  it('reads a receipt into cents and drops dates in the future or numbers it could not read', async () => {
    const { service, generateContent } = withReply('{"merchant":" Corner Cafe ","total":12.5,"currency":"EUR","date":"2026-11-10","category":"Food"}');
    expect(await service.scanReceipt(categories, { data: 'aGk=', mediaType: 'image/jpeg' }, '2026-11-12')).toEqual({
      merchant: 'Corner Cafe',
      amount: 1_250,
      currency: 'EUR',
      day: '2026-11-10',
      categoryId: 'food',
    });
    expect(generateContent.mock.calls[0][0]).toMatchObject({ config: { responseMimeType: 'application/json' } });
    const unsure = withReply('{"merchant":null,"total":null,"currency":"euros","date":"2027-01-01","category":"NONE"}');
    expect(await unsure.service.scanReceipt(categories, { data: 'aGk=', mediaType: 'image/png' }, '2026-11-12')).toEqual({
      merchant: null,
      amount: null,
      currency: null,
      day: null,
      categoryId: null,
    });
  });
});

describe('BudgetAiService.readPosting', () => {
  const page = { url: 'https://acme.example/jobs/1', text: 'Frontend Engineer at Acme. Remote.', jsonLd: '{"@type":"JobPosting","title":"Frontend Engineer"}' };
  const reply = {
    isPosting: true,
    role: ' Frontend Engineer ',
    company: 'Acme',
    location: 'Remote (APAC)',
    workMode: 'remote',
    salary: '$120k',
    employmentType: 'Full-time',
    postedOn: '2026-11-08',
    description: 'Build our dashboard.',
  };

  it('pulls the facts out of a posting and sends only that page', async () => {
    const { service, generateContent } = withReply(JSON.stringify({ ...reply, description: 'd'.repeat(35_000) }));
    const posting = await service.readPosting(page);
    expect(posting).toMatchObject({ role: 'Frontend Engineer', company: 'Acme', workMode: 'remote', postedOn: '2026-11-08' });
    expect(posting?.description).toHaveLength(30_000);
    const sent = JSON.stringify(generateContent.mock.calls[0][0]);
    expect(sent).toContain('Frontend Engineer at Acme. Remote.');
    expect(sent).toContain('JobPosting');
  });

  it('gives null for a page that is not a job posting', async () => {
    expect(await withReply(JSON.stringify({ ...reply, isPosting: false })).service.readPosting(page)).toBeNull();
  });

  it('drops a badly shaped date and cuts an overlong salary', async () => {
    const posting = await withReply(JSON.stringify({ ...reply, postedOn: 'last week', salary: 's'.repeat(100) })).service.readPosting(page);
    expect(posting?.postedOn).toBeNull();
    expect(posting?.salary).toHaveLength(80);
  });

  it('refuses a reply without a role', async () => {
    const { role: _role, ...noRole } = reply;
    await expect(withReply(JSON.stringify(noRole)).service.readPosting(page)).rejects.toThrow(BadGatewayException);
  });
});

describe('BudgetAiService.matchJob', () => {
  const job = { role: 'Frontend Engineer', company: 'Acme', description: 'React, TypeScript and Playwright.' };

  it('scores the CV against one job, within the limits, sending only the CV and that job', async () => {
    const reply = {
      pct: 82.6,
      summary: 's'.repeat(400),
      skillsHave: Array.from({ length: 14 }, (_, index) => `Skill ${index}`),
      skillsMissing: [`GraphQL ${'x'.repeat(60)}`],
    };
    const { service, generateContent } = withReply(JSON.stringify(reply));
    const match = await service.matchJob('Five years of React.', job);
    expect(match.pct).toBe(83);
    expect(match.summary).toHaveLength(300);
    expect(match.skillsHave).toHaveLength(12);
    expect(match.skillsMissing[0]).toHaveLength(40);
    const sent = JSON.stringify(generateContent.mock.calls[0][0]);
    expect(sent).toContain('Five years of React.');
    expect(sent).toContain('React, TypeScript and Playwright.');
  });

  it('keeps the percentage between 0 and 100', async () => {
    const base = { summary: 'ok', skillsHave: [], skillsMissing: [] };
    expect((await withReply(JSON.stringify({ ...base, pct: 140 })).service.matchJob('cv', job)).pct).toBe(100);
    expect((await withReply(JSON.stringify({ ...base, pct: -5 })).service.matchJob('cv', job)).pct).toBe(0);
  });

  it('refuses a reply without a percentage', async () => {
    await expect(withReply('{"summary":"ok","skillsHave":[],"skillsMissing":[]}').service.matchJob('cv', job)).rejects.toThrow(BadGatewayException);
  });
});

describe('BudgetAiService.editDiagram', () => {
  const replies = (...texts: string[]) => {
    const service = new BudgetAiService();
    const generateContent = vi.fn();
    for (const text of texts) generateContent.mockResolvedValueOnce({ text });
    Object.assign(service, { client: { models: { generateContent } } });
    return { service, generateContent };
  };
  // Gemini answers with the DBML as a list of lines, so line breaks can't get lost inside one JSON string.
  const reply = (dbml: string, summary = 'Added reviews.') => JSON.stringify({ lines: dbml.split('\n'), summary });

  it('joins the reply lines into DBML, keeping one column per line', async () => {
    const lines = ['Table authors {', '  id integer [primary key]', '  name varchar', '}'];
    const { service } = replies(JSON.stringify({ lines, summary: 'Added authors.' }));
    expect(await service.editDiagram('', 'A blog', (text) => (text.includes('\n') ? null : 'Line 1: one line'))).toEqual({ dbml: lines.join('\n'), summary: 'Added authors.' });
  });
  const check = (text: string) => (text.includes('broken') ? 'Line 1: Expect a closing brace' : null);

  it('returns the new DBML, unwrapped, sending only the diagram and the request', async () => {
    const { service, generateContent } = replies(reply('```dbml\nTable reviews { id int [pk] }\n```'));
    expect(await service.editDiagram('Table users { id int [pk] }', 'Add reviews', check)).toEqual({ dbml: 'Table reviews { id int [pk] }', summary: 'Added reviews.' });
    const sent = JSON.stringify(generateContent.mock.calls[0][0]);
    expect(sent).toContain('Table users { id int [pk] }');
    expect(sent).toContain('Add reviews');
  });

  it('tries once more with the problem when the first reply does not parse', async () => {
    const { service, generateContent } = replies(reply('Table broken {'), reply('Table fixed { id int }', 'Fixed.'));
    expect(await service.editDiagram('', 'A shop', check)).toEqual({ dbml: 'Table fixed { id int }', summary: 'Fixed.' });
    expect(JSON.stringify(generateContent.mock.calls[1][0])).toContain('Line 1: Expect a closing brace');
  });

  it('refuses after two replies that do not parse', async () => {
    const { service } = replies(reply('Table broken {'), reply('Table broken again {'));
    await expect(service.editDiagram('', 'A shop', check)).rejects.toThrow("The AI couldn't produce a valid diagram for that. Try rewording it.");
  });

  it('takes the DBML out of a fenced block with prose around it, or trims a plain reply', async () => {
    expect((await replies(reply('Here you go:\n```dbml\nTable a { id int }\n```\nDone')).service.editDiagram('', 'A', check)).dbml).toBe('Table a { id int }');
    expect((await replies(reply('  Table a { id int }  ')).service.editDiagram('', 'A', check)).dbml).toBe('Table a { id int }');
  });

  it('cuts a long summary to 200 characters', async () => {
    const { service } = replies(reply('Table a { id int }', 's'.repeat(300)));
    expect((await service.editDiagram('', 'A', check)).summary).toHaveLength(200);
  });
});
