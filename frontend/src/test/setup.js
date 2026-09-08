/**
 * Runs before every test file (wired via `test.setupFiles` in vite.config.js).
 */

import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Unmount between tests. Without this, a component from a previous test is
// still in the document and queries match the wrong element.
afterEach(() => {
  cleanup()
  localStorage.clear()
})

// jsdom implements neither of these, and both are used by DaisyUI components
// and any responsive logic — leaving them undefined throws during render.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
