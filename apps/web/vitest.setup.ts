import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
// The shadcn Drawer (vaul) reads the computed transform while dragging; jsdom computes none.
Object.defineProperty(CSSStyleDeclaration.prototype, 'webkitTransform', { configurable: true, get: () => 'none' });
Element.prototype.scrollIntoView = () => {};
// jsdom has no PointerEvent, so pointer events fired in tests would lose clientX/clientY; a MouseEvent carries them.
globalThis.PointerEvent ??= class PointerEvent extends MouseEvent {} as typeof PointerEvent;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
