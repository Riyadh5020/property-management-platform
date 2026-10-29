import { type NextFunction, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { createErrorResponse, isResponseError } from '../utils/app-response';

// Unique indexes → a message that tells the user which value is already taken.
const DUPLICATE_MESSAGES: Record<string, string> = {
  admins_email_unique_active_idx: 'An account with this email already exists.',
  floors_property_floor_number_uniq: 'This floor number already exists in this property.',
  units_floor_code_uniq: 'This unit code already exists on this floor.',
  parking_slot_uniq: 'This slot number already exists in this property.',
  invoices_lease_month_uniq: 'An invoice for this lease and month already exists.',
  invoices_no_uniq: 'This invoice number already exists.',
  payments_reverses_uniq: 'This payment has already been reversed.',
  manager_properties_uniq: 'This manager is already assigned to this property.',
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (isResponseError(err)) {
    res.status(err.statusCode).json(
      createErrorResponse({
        statusCode: err.statusCode,
        message: err.message,
        errors: err.errors,
      }),
    );
    return;
  }

  // Postgres unique violation: never surface as 500, and say which value is the duplicate
  if ((err as Error & { code?: string }).code === '23505') {
    const constraint = (err as Error & { constraint?: string }).constraint ?? '';
    res.status(StatusCodes.CONFLICT).json(
      createErrorResponse({
        statusCode: StatusCodes.CONFLICT,
        message: DUPLICATE_MESSAGES[constraint] ?? 'This record already exists.',
      }),
    );
    return;
  }

  console.error('[error]', err);

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
    createErrorResponse({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    }),
  );
};
