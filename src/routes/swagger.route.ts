import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { specs } from '../swagger';
import { API_PREFIX } from '../shared/constants';

const router = Router();

// Serve Swagger UI at the router root so mounting at `/api/v1/swagger`.
// Pass the mounted JSON URL explicitly so the browser requests the correct path
// (helps when the app is mounted under a prefix or deployed serverless).
const swaggerJsonUrl = `${API_PREFIX}/swagger/swagger.json`;
router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(specs, undefined, undefined, undefined, swaggerJsonUrl),
);

// Expose raw OpenAPI spec JSON at /swagger.json
router.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

export { router as swaggerRouter };
