import { defineConfig } from 'vitest/config';

const PORT = 5605;

export default defineConfig({
  server: { port: PORT, strictPort: true, host: 'localhost' },
  preview: { port: PORT, strictPort: true, host: 'localhost' },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.d.ts'],
      thresholds: { lines: 90, statements: 90, branches: 90, functions: 90 },
    },
  },
});
