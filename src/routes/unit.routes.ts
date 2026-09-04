import { Router } from 'express';

import { unitController } from '../controllers/unit.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import { validateCreateUnit, validateUpdateUnit } from '../middlewares/unit.middleware';

const unitRouter = Router();

unitRouter.get('/', authenticateAdmin, unitController.getUnits);
unitRouter.get('/:id', authenticateAdmin, unitController.getUnitById);
unitRouter.post('/create', authenticateAdmin, validateCreateUnit, unitController.createUnit);
unitRouter.put('/:id', authenticateAdmin, validateUpdateUnit, unitController.updateUnit);
unitRouter.delete('/:id', authenticateAdmin, unitController.deleteUnit);

export { unitRouter };
