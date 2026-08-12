import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

// Only present in DOM-like environments; skip for node-environment test files.
if (globalThis.navigator) {
  Object.defineProperty(globalThis.navigator, 'geolocation', {
    value: mockGeolocation,
    writable: true,
  });
}

// Mock fetch
globalThis.fetch = vi.fn();
