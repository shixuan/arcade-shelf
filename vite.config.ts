import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      rollupTypes: true,
      include: ['src'],
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ArcadeShelf',
      formats: ['es', 'umd'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.umd.cjs'),
    },
    sourcemap: true,
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.name === 'style.css' ? 'style.css' : asset.name ?? 'asset',
      },
    },
  },
});
