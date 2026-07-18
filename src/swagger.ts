import swaggerJSDoc from 'swagger-jsdoc';

import { API_PREFIX } from './shared/constants';

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
  // Scan all TypeScript source files for JSDoc comments so every API is discovered
  apis: ['./src/**/*.ts'],
};

export const specs = swaggerJSDoc(options);
