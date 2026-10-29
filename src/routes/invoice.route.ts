import { Router } from 'express';

import {
  addPayment,
  generateInvoices,
  getInvoice,
  getInvoices,
  reversePayment,
  updateInvoice,
  voidInvoice,
} from '../controllers/invoice.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateAddPayment,
  validateGenerateInvoices,
  validateInvoiceId,
  validateReversePayment,
  validateUpdateInvoice,
} from '../middlewares/invoice.middleware';

const invoiceRouter = Router();

invoiceRouter.get('/', authenticateAdmin, getInvoices);
invoiceRouter.post('/generate', authenticateAdmin, validateGenerateInvoices, generateInvoices);
invoiceRouter.get('/:id', authenticateAdmin, validateInvoiceId, getInvoice);
invoiceRouter.put('/:id', authenticateAdmin, validateUpdateInvoice, updateInvoice);
invoiceRouter.post('/:id/payments', authenticateAdmin, validateAddPayment, addPayment);
invoiceRouter.post(
  '/:id/payments/:paymentId/reverse',
  authenticateAdmin,
  validateReversePayment,
  reversePayment,
);
invoiceRouter.patch(
  '/:id/void',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateInvoiceId,
  voidInvoice,
);

export { invoiceRouter };
