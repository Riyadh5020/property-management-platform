import { type Request, type Response } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';

import { type CreateTenantInput, type UpdateTenantInput } from '../models/tenant.model';
import {
  createTenant as createService,
  deleteTenant as deleteService,
  getAllTenants as getAllService,
  getTenantById as getByIdService,
  updateTenant as updateService,
} from '../services/tenant.service';
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

const createTenant = asyncHandler(
  async (req: Request<ParamsDictionary, unknown, CreateTenantInput>, res: Response) => {
    ok(res, StatusCodes.CREATED, await createService(req.body, actor(req)));
  },
);

const getTenants = asyncHandler(
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
      },
      actor(req),
    );
    ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
  },
);

const getTenantById = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await getByIdService(req.params.id, actor(req)));
});

const updateTenant = asyncHandler(
  async (req: Request<{ id: string }, unknown, UpdateTenantInput>, res: Response) => {
    ok(res, StatusCodes.OK, await updateService(req.params.id, req.body, actor(req)));
  },
);

const deleteTenant = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await deleteService(req.params.id, actor(req)));
});

export { createTenant, deleteTenant, getTenantById, getTenants, updateTenant };
