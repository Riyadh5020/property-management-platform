import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { type RecordKind } from '../models/building-record.model';
import * as service from '../services/building-record.service';
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

const kindOf = (req: Request): RecordKind => req.params.kind as RecordKind;

export const getRecords = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const { limit, offset } = parsePaging(q.limit, q.offset);
  const { items, total } = await service.listRecords(
    kindOf(req),
    {
      limit,
      offset,
      ...(q.search ? { search: q.search } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
    },
    actor(req),
  );
  ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
});

export const createRecord = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    StatusCodes.CREATED,
    await service.createRecord(kindOf(req), req.body as Record<string, unknown>, actor(req)),
  );
});

export const updateRecord = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    StatusCodes.OK,
    await service.updateRecord(
      kindOf(req),
      String(req.params.id),
      req.body as Record<string, unknown>,
      actor(req),
    ),
  );
});

export const deleteRecord = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteRecord(kindOf(req), String(req.params.id), actor(req));
  ok(res, StatusCodes.OK, null);
});
