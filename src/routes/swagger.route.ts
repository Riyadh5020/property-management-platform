import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { specs } from '../swagger';

const router = Router();

// Serve Swagger UI at the router root so mounting at `/api/v1/swagger`
router.use('/', swaggerUi.serve, swaggerUi.setup(specs));

// Expose raw OpenAPI spec JSON at /swagger.json
router.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

export { router as swaggerRouter };
