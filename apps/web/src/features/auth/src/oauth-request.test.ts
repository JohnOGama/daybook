import { expect, it } from 'vitest';
import { withWaitingApp } from './oauth-request';

const waiting = '?client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&sig=abc&email=old%40b.c';

it('carries a waiting app’s signed query to the next auth page, minus the email', () => {
  expect(withWaitingApp('/sign-in', waiting)).toBe('/sign-in?client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&sig=abc');
  expect(withWaitingApp('/verify?email=a%40b.c', waiting)).toBe('/verify?email=a%40b.c&client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&sig=abc');
});

it('leaves the path alone when no app is waiting', () => {
  expect(withWaitingApp('/verify?email=a%40b.c', '?email=x%40y.z')).toBe('/verify?email=a%40b.c');
  expect(withWaitingApp('/sign-up', '')).toBe('/sign-up');
});
