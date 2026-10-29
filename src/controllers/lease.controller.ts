import { type Request, type Response } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { type CreateLeaseInput, type UpdateLeaseInput } from '../models/lease.model';
import {
  createLease as createService,
  deleteLease as deleteService,
  getAllLeases as getAllService,
  getLeaseById as getByIdService,
  updateLease as updateService,
} from '../services/lease.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

const actor = (req: Request): { id: string | null; role: string | null } => ({
  id: (req as unknown as { id?: string }).id ?? null,
  role: (req as unknown as { adminType?: string }).adminType ?? null,
});

const ok = (res: Response, status: number, data: unknown): void => {
  res
    .status(status)
    .json(
      createSuccessResponse({ statusCode: status, message: SUCCESS_MESSAGES.common.success, data }),
    );
};

const createLease = asyncHandler(
  async (req: Request<ParamsDictionary, unknown, CreateLeaseInput>, res: Response) => {
    ok(res, StatusCodes.CREATED, await createService(req.body, actor(req)));
  },
);

const getLeases = asyncHandler(
  async (
    req: Request<ParamsDictionary, unknown, unknown, Record<string, string>>,
    res: Response,
  ) => {
    const q = req.query;
    const { limit, offset } = parsePaging(q.limit, q.offset);

    const { items, total } = await getAllService(
      {
        limit,
        offset,
        ...(q.search ? { search: q.search } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.propertyId ? { propertyId: q.propertyId } : {}),
        ...(q.unitId ? { unitId: q.unitId } : {}),
        ...(q.tenantId ? { tenantId: q.tenantId } : {}),
      },
      actor(req),
    );
    ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
  },
);

const getLeaseById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await getByIdService(req.params.id, actor(req)));
});

const updateLease = asyncHandler(
  async (req: Request<{ id: string }, unknown, UpdateLeaseInput>, res: Response) => {
    ok(res, StatusCodes.OK, await updateService(req.params.id, req.body, actor(req)));
  },
);

const deleteLease = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await deleteService(req.params.id, actor(req)));
});

export { createLease, deleteLease, getLeaseById, getLeases, updateLease };
