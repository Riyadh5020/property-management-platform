import { Router } from 'express';

import { specs } from '../swagger';
import { API_PREFIX } from '../shared/constants';

const router = Router();

// CDN version pinned to the major version of the `swagger-ui-dist` package
// installed locally (kept in sync with `swagger-ui-express`'s dependency).
const SWAGGER_UI_CDN_VERSION = '5';

// Expose raw OpenAPI spec JSON at /swagger.json
router.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(specs);
});

// Serve a self-contained Swagger UI page that loads its JS/CSS assets from a
// CDN instead of via `swagger-ui-express`'s bundled `express.static` serving.
//
// `swaggerUi.serve` reads its assets straight out of `node_modules/swagger-ui-dist`
// at request time. That works fine locally, but Vercel's serverless build only
// traces/bundles files it can statically detect — it misses these dynamically
// resolved asset files, so the JS/CSS 404 in production and the page renders
// blank even though it works locally. Loading the assets from a CDN sidesteps
// the bundling issue entirely.
router.get(['/', ''], (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Building Management API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_CDN_VERSION}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_CDN_VERSION}/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_CDN_VERSION}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '${API_PREFIX}/swagger/swagger.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout',
        });
      };
    </script>
  </body>
</html>`);
});

export { router as swaggerRouter };
