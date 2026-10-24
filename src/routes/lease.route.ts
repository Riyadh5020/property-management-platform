import { Router } from 'express';

import {
  createLease,
  deleteLease,
  getLeaseById,
  getLeases,
  updateLease,
} from '../controllers/lease.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import {
  validateCreateLease,
  validateLeaseId,
  validateUpdateLease,
} from '../middlewares/lease.middleware';

const leaseRouter = Router();

leaseRouter.get('/', authenticateAdmin, getLeases);
leaseRouter.get('/:id', authenticateAdmin, validateLeaseId, getLeaseById);
leaseRouter.post('/create', authenticateAdmin, validateCreateLease, createLease);
leaseRouter.put('/:id', authenticateAdmin, validateUpdateLease, updateLease);
leaseRouter.delete('/:id', authenticateAdmin, validateLeaseId, deleteLease);

export { leaseRouter };
