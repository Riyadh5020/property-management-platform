import { Router } from 'express';

import {
  createRecord,
  deleteRecord,
  getRecords,
  updateRecord,
} from '../controllers/building-record.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateRecord,
  validateRecordId,
  validateRecordKind,
  validateUpdateRecord,
} from '../middlewares/building-record.middleware';

const buildingRecordRouter = Router();

buildingRecordRouter.get('/:kind', authenticateAdmin, validateRecordKind, getRecords);
buildingRecordRouter.post('/:kind', authenticateAdmin, validateCreateRecord, createRecord);
buildingRecordRouter.put('/:kind/:id', authenticateAdmin, validateUpdateRecord, updateRecord);
buildingRecordRouter.delete(
  '/:kind/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateRecordId,
  deleteRecord,
);

export { buildingRecordRouter };
