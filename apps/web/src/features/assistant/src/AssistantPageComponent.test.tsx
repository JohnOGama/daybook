import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssistantPageComponent, greeting } from './AssistantPageComponent';
import { dotField, pushAway, ThinkingDotsComponent } from './ThinkingDotsComponent';

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

  it('switches state on the field only, so the dots never restart and glide from one state to the other', () => {
    render(<AssistantPageComponent />);
    const img = screen.getByRole('img');
    const dots = () => [...img.children] as HTMLElement[];
    // Every dot keeps the same classes and timings in both states; only the field's class changes.
    const snapshot = () => dots().map((dot) => dot.outerHTML);
    const idle = snapshot();
    expect(img.className).not.toContain('assistant-field-thinking');
    // Idle twinkles at scattered times; the breath follows distance from the centre.
    expect(new Set(dots().map((dot) => dot.style.getPropertyValue('--twinkle-delay'))).size).toBeGreaterThan(20);
    expect(new Set(dots().map((dot) => dot.style.getPropertyValue('--breath-delay'))).size).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole('button', { name: "What's on today?" }));
    expect(img.className).toContain('assistant-field-thinking');
    expect(snapshot()).toEqual(idle);
  });

  it('thinking breathes out from the centre: no circling, dots farther out start later', () => {
    const field = dotField();
    const centre = field.find((dot) => dot.x === 80 && dot.y === 80);
    const left = field.find((dot) => dot.x === 0 && dot.y === 80);
    const right = field.find((dot) => dot.x === 160 && dot.y === 80);
    // Same distance, same moment: the breath is round, not a sweep going round.
    expect(left?.breath).toBe(right?.breath);
    expect(centre?.breath).toBe(0);
    expect(right?.breath).toBeGreaterThan(0);
    // And the idle twinkle is the same on every render, not random each time.
    expect(dotField().map((dot) => dot.twinkle)).toEqual(field.map((dot) => dot.twinkle));
  });

  it('gives every dot a way to move: in and out from the centre while thinking, a small drift while idle', () => {
    const field = dotField();
    const right = field.find((dot) => dot.x === 160 && dot.y === 80);
    expect(right?.dx).toBeCloseTo(1);
    expect(right?.dy).toBeCloseTo(0);
    expect(field.every((dot) => Math.abs(dot.fx) <= 4 && Math.abs(dot.fy) <= 4)).toBe(true);
    expect(new Set(field.map((dot) => `${dot.fx},${dot.fy}`)).size).toBeGreaterThan(10);

    render(<AssistantPageComponent />);
    const dot = screen.getByRole('img').children[0] as HTMLElement;
    expect(['--dx', '--dy', '--fx', '--fy'].every((name) => dot.style.getPropertyValue(name) !== '')).toBe(true);
  });
});

describe('pushAway', () => {
  const dot = { x: 80, y: 80 };
  it('pushes a dot near the pointer straight away from it, harder the closer it is, and grows it', () => {
    const near = pushAway(dot, { x: 83 - 10, y: 83 });
    const nearer = pushAway(dot, { x: 83 - 4, y: 83 });
    expect(near.x).toBeGreaterThan(0);
    expect(near.y).toBeCloseTo(0);
    expect(nearer.x).toBeGreaterThan(near.x);
    expect(nearer.x).toBeLessThanOrEqual(12);
    expect(near.grow).toBeGreaterThan(1);
  });

  it('leaves dots outside the reach alone', () => {
    expect(pushAway(dot, { x: 300, y: 300 })).toEqual({ x: 0, y: 0, grow: 1 });
  });

  it('moves the dots under the pointer, and lets them go when it leaves', () => {
    vi.useFakeTimers();
    render(<ThinkingDotsComponent thinking={false} />);
    const field = screen.getByRole('img');
    field.getBoundingClientRect = () => ({ left: 0, top: 0, right: 166, bottom: 166, width: 166, height: 166, x: 0, y: 0, toJSON: () => ({}) });
    const centre = [...field.children].find((d) => (d as HTMLElement).style.left === '80px' && (d as HTMLElement).style.top === '80px') as HTMLElement;
    // The pointer just left of the centre dot's middle (83, 83): it is pushed right.
    fireEvent.pointerMove(field, { clientX: 76, clientY: 83 });
    act(() => vi.advanceTimersByTime(20));
    expect(Number.parseFloat(centre.style.getPropertyValue('--hx'))).toBeGreaterThan(0);
    fireEvent.pointerLeave(field);
    act(() => vi.advanceTimersByTime(20));
    expect(centre.style.getPropertyValue('--hx')).toBe('0px');
    vi.useRealTimers();
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
