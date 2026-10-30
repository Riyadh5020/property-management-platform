import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { getFlatStatus } from '../repositories/flat-status.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getRestrictedFlatFields, maskFlatStatusRows } from '../services/flat-status.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createResponseError, createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

export const getFlats = asyncHandler(async (req: Request, res: Response) => {
  const id = (req as unknown as { id?: string }).id ?? '';
  const role = (req as unknown as { adminType?: string }).adminType ?? '';
  const permissions = (req as unknown as { permissions?: Record<string, boolean> | null })
    .permissions;
  const restrictedFields = getRestrictedFlatFields(role, permissions);
  const q = req.query as Record<string, string | undefined>;
  const { limit, offset } = parsePaging(q.limit, q.offset);

  const opts: Parameters<typeof getFlatStatus>[0] = {
    limit,
    offset,
    ...(q.search ? { search: q.search } : {}),
    ...(q.occupancy ? { occupancy: q.occupancy } : {}),
    ...(q.propertyId ? { propertyId: q.propertyId } : {}),
  };

  if (role === 'owner') {
    opts.ownerId = id;
  } else if (role === 'manager') {
    const assigned = await listPropertyIdsForManager(id);
    if (assigned.length === 0) {
      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: { items: [], pagination: { limit, offset, total: 0 }, restrictedFields },
        }),
      );
      return;
    }
    opts.propertyIds = assigned;
  } else if (role !== 'superAdmin') {
    throw createResponseError({ statusCode: StatusCodes.FORBIDDEN, message: 'Unauthorized' });
  }

  const { items, total } = await getFlatStatus(opts);
  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: {
        items: maskFlatStatusRows(items, restrictedFields),
        pagination: { limit, offset, total },
        restrictedFields,
      },
    }),
  );
});
