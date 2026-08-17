import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  splitting: false,
  treeshake: true,
  target: 'node20',
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
});
