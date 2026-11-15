import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPageComponent, greeting } from './AssistantPageComponent';
import { dotField } from './ThinkingDotsComponent';

const status = () => screen.getByRole('img').getAttribute('aria-label');

describe('AssistantPageComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 16, 19, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('is idle by default, with the greeting for the hour', () => {
    render(<AssistantPageComponent />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good evening. What can I help with?');
    expect(status()).toBe('Ready when you are');
  });

  it('a suggestion thinks for 2.5 s, then goes back to idle', () => {
    render(<AssistantPageComponent />);
    fireEvent.click(screen.getByRole('button', { name: "What's on today?" }));
    expect(status()).toBe('Thinking…');
    act(() => vi.advanceTimersByTime(2499));
    expect(status()).toBe('Thinking…');
    act(() => vi.advanceTimersByTime(1));
    expect(status()).toBe('Ready when you are');
  });

  it('sending clears the input and thinks', () => {
    render(<AssistantPageComponent />);
    const input = screen.getByRole('textbox', { name: 'Ask the assistant' });
    fireEvent.change(input, { target: { value: 'Plan my week' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(input).toHaveValue('');
    expect(status()).toBe('Thinking…');
  });

  it('an empty or blank input does not think', () => {
    render(<AssistantPageComponent />);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(status()).toBe('Ready when you are');
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask the assistant' }), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('textbox', { name: 'Ask the assistant' }));
    expect(status()).toBe('Ready when you are');
  });

  it('a second send while thinking restarts the 2.5 s', () => {
    render(<AssistantPageComponent />);
    fireEvent.click(screen.getByRole('button', { name: "What's on today?" }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByRole('button', { name: 'Did the deploy pass?' }));
    act(() => vi.advanceTimersByTime(2000));
    expect(status()).toBe('Thinking…');
    act(() => vi.advanceTimersByTime(500));
    expect(status()).toBe('Ready when you are');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmounting while thinking leaves no timer running', () => {
    const { unmount } = render(<AssistantPageComponent />);
    fireEvent.click(screen.getByRole('button', { name: "What's on today?" }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('animates the dots differently when idle and when thinking, and not at all under reduced motion', () => {
    render(<AssistantPageComponent />);
    const dots = () => [...screen.getByRole('img').children] as HTMLElement[];
    expect(dots().every((dot) => dot.className.includes('assistant-dot-idle') && dot.style.animationDelay === '')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: "What's on today?" }));
    expect(dots().every((dot) => dot.className.includes('assistant-dot-thinking'))).toBe(true);
    expect(new Set(dots().map((dot) => dot.style.animationDelay)).size).toBeGreaterThan(3);
  });
});

describe('dotField', () => {
  it('keeps the grid to a circle', () => {
    const dots = dotField();
    expect(dots.every((dot) => dot.distance <= 5.2)).toBe(true);
    expect(dots.length).toBeGreaterThanOrEqual(75);
    expect(dots.length).toBeLessThanOrEqual(90);
    for (const corner of [
      [0, 0],
      [160, 0],
      [0, 160],
      [160, 160],
    ]) {
      expect(dots.some((dot) => dot.x === corner[0] && dot.y === corner[1])).toBe(false);
    }
  });
});

describe('greeting', () => {
  it.each([
    [9, 'Good morning. What can I help with?'],
    [12, 'Good afternoon. What can I help with?'],
    [18, 'Good evening. What can I help with?'],
  ])('at %i:00 says %s', (hour, text) => {
    expect(greeting(hour)).toBe(text);
  });
});
