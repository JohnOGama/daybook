import { expect, it } from 'vitest';
import { describeTaskList, isTaskList, parseTaskList } from './parse-task-list';

const sample = `- [ ]  site admin pref → Default order
- [ ]  Add legacy path
- [ ]  If Site SSO
    - [ ]  Enable SSO config in payload
- [ ]  If has auto approval feature
    - [ ]  Set the correct email
    - [ ]  Check the config with previous store
- [ ]  Enable reCAPTCHA`;

it('turns a checklist into tasks with subtasks, in order', () => {
  expect(parseTaskList(sample)).toEqual([
    { title: 'site admin pref → Default order', subtasks: [] },
    { title: 'Add legacy path', subtasks: [] },
    { title: 'If Site SSO', subtasks: ['Enable SSO config in payload'] },
    {
      title: 'If has auto approval feature',
      subtasks: ['Set the correct email', 'Check the config with previous store'],
    },
    { title: 'Enable reCAPTCHA', subtasks: [] },
  ]);
});

it.each([
  ['bullets', '- One\n* Two\n+ Three'],
  ['numbers', '1. One\n2) Two\n3. Three'],
  ['plain lines', 'One\n\nTwo\r\nThree'],
  ['checked boxes', '- [x] One\n- [X] Two\n- [] Three'],
])('reads %s', (_, text) => {
  expect(parseTaskList(text).map((task) => task.title)).toEqual(['One', 'Two', 'Three']);
});

it('counts tabs as indentation and flattens deeper levels to one', () => {
  expect(parseTaskList('A\n\tB\n\t\tC\nD')).toEqual([
    { title: 'A', subtasks: ['B', 'C'] },
    { title: 'D', subtasks: [] },
  ]);
});

it('does not make a list that is indented throughout into subtasks', () => {
  expect(parseTaskList('    - A\n    - B')).toEqual([
    { title: 'A', subtasks: [] },
    { title: 'B', subtasks: [] },
  ]);
});

it('skips empty checkboxes and keeps a hyphen inside a title', () => {
  expect(parseTaskList('- [ ]\n- well-known path')).toEqual([{ title: 'well-known path', subtasks: [] }]);
});

it('cuts a title at the 200 character limit', () => {
  expect(parseTaskList('x'.repeat(250))[0].title).toHaveLength(200);
});

it('only treats more than one item as a list', () => {
  expect(isTaskList('Just one title')).toBe(false);
  expect(isTaskList('One\nTwo')).toBe(true);
  expect(isTaskList('One\n  Under it')).toBe(true);
});

it('describes the counts', () => {
  expect(describeTaskList([{ subtasks: [] }])).toBe('1 task');
  expect(describeTaskList([{ subtasks: [1] }, { subtasks: [1, 2] }])).toBe('2 tasks and 3 subtasks');
});
