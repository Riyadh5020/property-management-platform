import { Router } from 'express';

import { getFlats } from '../controllers/flat-status.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';

const flatStatusRouter = Router();
flatStatusRouter.get('/', authenticateAdmin, getFlats);

export { flatStatusRouter };
