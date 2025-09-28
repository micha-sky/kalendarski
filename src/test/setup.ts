import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
};

Object.defineProperty(globalThis.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

// Mock fetch
globalThis.fetch = vi.fn();

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_OPENWEATHER_API_KEY: 'test-api-key',
  },
}));
