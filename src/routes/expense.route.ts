import { Router } from 'express';

import {
  createExpense,
  deleteExpense,
  getExpense,
  getExpenses,
  updateExpense,
} from '../controllers/expense.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateExpense,
  validateExpenseId,
  validateUpdateExpense,
} from '../middlewares/expense.middleware';

const expenseRouter = Router();

expenseRouter.get('/', authenticateAdmin, getExpenses);
expenseRouter.get('/:id', authenticateAdmin, validateExpenseId, getExpense);
expenseRouter.post('/create', authenticateAdmin, validateCreateExpense, createExpense);
expenseRouter.put('/:id', authenticateAdmin, validateUpdateExpense, updateExpense);
expenseRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateExpenseId,
  deleteExpense,
);

export { expenseRouter };
