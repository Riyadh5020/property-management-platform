import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { type CreateAdminInput, type AdminId } from '../models/admin.model';
import {
  createAdmin as createAdminService,
  loginAdmin as loginAdminService,
  updateAdmin as updateAdminService,
  updateAdminStatus as updateAdminStatusService,
  getAdminById as getAdminByIdService,
  listAdmins as listAdminsService,
} from '../services/admin.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import {
  type LoginAdminInput,
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminStatusInput,
} from '../types/admin.types';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const getAdmins = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const { limit, offset, search, sortBy, sortDir } = req.query as unknown as {
      limit?: string;
      offset?: string;
      search?: string;
      sortBy?: string;
      sortDir?: string;
    };

    const DEFAULT_LIMIT = 20;
    const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
    const offsetNumber = offset ? Number(offset) : 0;

    const { items, total } = await listAdminsService({
      limit: limitNumber,
      offset: offsetNumber,
      search,
      sortBy,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    });

    const currentPageNumber = Math.floor(offsetNumber / limitNumber) + 1;

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: {
          items,
          pagination: {
            limit: limitNumber,
            offset: offsetNumber,
            total,
            currentPageNumber,
            sortBy: sortBy ?? 'createdAt',
            sortDir: sortDir === 'asc' ? 'asc' : 'desc',
          },
        },
      }),
    );
  },
);

const getAdminById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;

    const admin = await getAdminByIdService(id);

    if (!admin) {
      res.status(StatusCodes.NOT_FOUND).json(
        createSuccessResponse({
          statusCode: StatusCodes.NOT_FOUND,
          message: 'Admin not found',
          data: null,
        }),
      );
      return;
    }

    const {
      password: _password,
      passwordResetToken: _passwordResetToken,
      twoFactorSecret: _twoFactorSecret,
      ...safeAdmin
    } = admin;

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safeAdmin,
      }),
    );
  },
);

const createAdmin = asyncHandler(
  async (req: Request<unknown, unknown, CreateAdminInput>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;

    // do not trust client-provided createdBy/updatedBy — use authenticated admin id
    const admin = await createAdminService(req.body, actingAdminId ?? null);
    const {
      password: _password,
      passwordResetToken: _passwordResetToken,
      twoFactorSecret: _twoFactorSecret,
      ...safeAdmin
    } = admin;

    res.status(StatusCodes.CREATED).json({
      ...createSuccessResponse({
        statusCode: StatusCodes.CREATED,
        message: SUCCESS_MESSAGES.common.success,
        data: safeAdmin,
      }),
    });
  },
);

const loginAdmin = asyncHandler(
  async (req: Request<unknown, unknown, LoginAdminInput>, res: Response): Promise<void> => {
    const loginResponse = await loginAdminService({
      ...req.body,
      loginIp: req.ip,
    });

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: loginResponse,
      }),
    );
  },
);

const updateAdmin = asyncHandler(
  async (
    req: Request<UpdateAdminParams, unknown, UpdateAdminInput>,
    res: Response,
  ): Promise<void> => {
    // get the id attached by authentication middleware (the acting admin's id)
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;

    // ensure updatedBy is set to the acting admin id (do not trust client-provided value)
    const inputWithUpdatedBy: UpdateAdminInput = {
      ...req.body,
      // cast here because UpdateAdminInput.updatedBy is a UUID literal type
      updatedBy: actingAdminId as unknown as UpdateAdminInput['updatedBy'],
    };

    const admin = await updateAdminService(req.params.id, inputWithUpdatedBy);
    const {
      password: _password,
      passwordResetToken: _passwordResetToken,
      twoFactorSecret: _twoFactorSecret,
      ...safeAdmin
    } = admin;

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safeAdmin,
      }),
    );
  },
);

const updateAdminStatus = asyncHandler(
  async (
    req: Request<UpdateAdminParams, unknown, UpdateAdminStatusInput>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;

    const admin = await updateAdminStatusService(
      req.params.id,
      req.body.status,
      actingAdminId as unknown as AdminId | null,
    );
    const {
      password: _password,
      passwordResetToken: _passwordResetToken,
      twoFactorSecret: _twoFactorSecret,
      ...safeAdmin
    } = admin;

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safeAdmin,
      }),
    );
  },
);

export { createAdmin, loginAdmin, updateAdmin, updateAdminStatus, getAdmins, getAdminById };
