import path from 'path';
import fs from 'fs';
import swaggerJSDoc from 'swagger-jsdoc';

import { API_PREFIX } from './shared/constants';

// Determine which file patterns to scan for JSDoc/openapi annotations.
// In development we scan the TypeScript sources; in production (after `tsc`) scan compiled JS output.
const cwd = process.cwd();
const tsGlob = path.join(cwd, 'src', '**', '*.ts');
const distGlob = path.join(cwd, 'dist', '**', '*.js');

const apis: string[] = [];
// Prefer compiled JS when a dist folder is present (typical production build)
if (fs.existsSync(path.join(cwd, 'dist'))) {
  apis.push(distGlob);
} else {
  apis.push(tsGlob);
}

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Building Management API',
      version: '1.0.0',
      description: 'API documentation for Building Management backend',
    },
    servers: [{ url: API_PREFIX }],
  },
  apis,
};

export const specs = swaggerJSDoc(options);
