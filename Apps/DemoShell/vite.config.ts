import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default {
  root,
  build: {
    outDir: resolve(root, '../../dist/static-demo'),
    emptyOutDir: true,
  },
};
