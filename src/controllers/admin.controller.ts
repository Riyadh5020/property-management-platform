import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { adminRoles, adminStatuses } from '../enums/admin.enum';
import { type AdminId, type AdminRole, type CreateAdminInput } from '../models/admin.model';
import {
  adminResetPasswordFor,
  createAdmin as createAdminService,
  forgotAdminPassword as forgotAdminPasswordService,
  getAdminById as getAdminByIdService,
  listAdmins as listAdminsService,
  loginAdmin as loginAdminService,
  logoutAdmin as logoutAdminService,
  refreshAdminAccessToken,
  resetAdminPassword as resetAdminPasswordService,
  updateAdmin as updateAdminService,
  updateAdminStatus as updateAdminStatusService,
} from '../services/admin.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import {
  type LoginAdminInput,
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminStatusInput,
} from '../types/admin.types';
import { createResponseError, createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

const toSafeAdmin = (admin: object): Record<string, unknown> => {
  const {
    password: _password,
    passwordResetToken: _passwordResetToken,
    passwordResetExpiresAt: _passwordResetExpiresAt,
    twoFactorSecret: _twoFactorSecret,
    tokenVersion: _tokenVersion,
    refreshTokenVersion: _refreshTokenVersion,
    lastLoginIp: _lastLoginIp,
    failedLoginAttempts: _failedLoginAttempts,
    lockedUntil: _lockedUntil,
    ...safe
  } = admin as Record<string, unknown>;
  return safe;
};

const getAdmins = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const { limit, offset, search, sortBy, sortDir, role, status } = req.query as unknown as {
      limit?: string;
      offset?: string;
      search?: string;
      sortBy?: string;
      sortDir?: string;
      role?: string;
      status?: string;
    };
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const { limit: limitNumber, offset: offsetNumber } = parsePaging(limit, offset);

    const { items, total } = await listAdminsService({
      limit: limitNumber,
      offset: offsetNumber,
      search,
      ...(actingAdminType === 'owner' && actingAdminId ? { ownerId: actingAdminId } : {}),
      sortBy,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
      role: role && (adminRoles as readonly string[]).includes(role) ? role : undefined,
      status: status && (adminStatuses as readonly string[]).includes(status) ? status : undefined,
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

    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const allowed =
      actingAdminType === 'superAdmin' ||
      admin.id === actingAdminId ||
      (actingAdminType === 'owner' && admin.ownerId === actingAdminId);

    if (!allowed) {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Unauthorized',
      });
    }

    const safeAdmin = toSafeAdmin(admin);

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
    const actingAdminType = (req as unknown as { adminType?: AdminRole }).adminType ?? null;

    const admin = await createAdminService(req.body, actingAdminId, actingAdminType);
    const safeAdmin = toSafeAdmin(admin);

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
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    // Only a superAdmin may change an admin's role — block everyone else here
    if (req.body.role && actingAdminType !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: "Only a superAdmin can change an admin's role",
      });
    }

    const inputWithUpdatedBy: UpdateAdminInput = {
      ...req.body,
      updatedBy: actingAdminId as unknown as UpdateAdminInput['updatedBy'],
    };

    const admin = await updateAdminService(req.params.id, inputWithUpdatedBy);
    const safeAdmin = toSafeAdmin(admin);

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
    const safeAdmin = toSafeAdmin(admin);

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safeAdmin,
      }),
    );
  },
);

const refreshToken = asyncHandler(
  async (
    req: Request<unknown, unknown, { refreshToken: string }>,
    res: Response,
  ): Promise<void> => {
    const result = await refreshAdminAccessToken(req.body.refreshToken);
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: result,
      }),
    );
  },
);

const logoutAdmin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as unknown as { id?: string }).id;

  if (adminId) {
    await logoutAdminService(adminId as unknown as AdminId);
  }

  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: null,
    }),
  );
});

const forgotPassword = asyncHandler(
  async (req: Request<unknown, unknown, { email: string }>, res: Response): Promise<void> => {
    await forgotAdminPasswordService(req.body.email);

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: 'If that email exists, a reset code has been sent.',
        data: null,
      }),
    );
  },
);

const resetPassword = asyncHandler(
  async (
    req: Request<unknown, unknown, { email: string; code: string; newPassword: string }>,
    res: Response,
  ): Promise<void> => {
    await resetAdminPasswordService(req.body.email, req.body.code, req.body.newPassword);

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: null,
      }),
    );
  },
);

const adminResetPassword = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, { newPassword: string }>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: AdminRole }).adminType ?? null;

    await adminResetPasswordFor(
      req.params.id,
      req.body.newPassword,
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: 'Password has been reset',
        data: null,
      }),
    );
  },
);

export {
  adminResetPassword,
  createAdmin,
  forgotPassword,
  getAdminById,
  getAdmins,
  loginAdmin,
  logoutAdmin,
  refreshToken,
  resetPassword,
  updateAdmin,
  updateAdminStatus,
};
