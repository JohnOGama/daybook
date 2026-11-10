import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { ResizableSidebarComponent } from './ResizableSidebarComponent';

const STORAGE_KEY = 'daybook.sidebar-width';

function renderSidebar() {
  render(<ResizableSidebarComponent>Nav</ResizableSidebarComponent>);
  return screen.getByRole('separator', { name: 'Resize sidebar' });
}

beforeEach(() => localStorage.clear());

it('resizes with the arrow keys and remembers the width', () => {
  const handle = renderSidebar();
  expect(handle).toHaveAttribute('aria-valuenow', '224');
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(handle).toHaveAttribute('aria-valuenow', '234');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('234');
});

it.each([
  ['nonsense', '224'],
  ['9999', '420'],
  ['10', '180'],
])('reads a stored width of %s as %s', (stored, expected) => {
  localStorage.setItem(STORAGE_KEY, stored);
  expect(renderSidebar()).toHaveAttribute('aria-valuenow', expected);
});
