/* eslint-disable import/no-default-export */
// tsup.config.ts
import { defineConfig } from 'tsup'
import builtinModules from 'builtin-modules'

export default defineConfig({
  entry: ['src/index.ts'], // add other entries if you want separate files
  outDir: 'dist',
  platform: 'node',
  target: 'node20',
  format: ['esm'], // keep ESM
  splitting: false, // simple single-file per entry
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
  minify: false,

  // leave Node built-ins and CJS deps out of the bundle
  external: [
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),

    // CJS deps you’re using — keep them external so Node loads them natively:
    'ws',
    'express',
    'express-ws',
    'swagger-ui-express',
    'express-winston',
    'winston',
    'apicache',
    'express-prom-bundle',
    'prom-client',
    'cors',
    'body-parser',
    'dotenv',
  ],

  // provide `require` for places in your code where you still use it (Swagger block)
  esbuildOptions(options) {
    options.banner = {
      js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
    }
  },
})
