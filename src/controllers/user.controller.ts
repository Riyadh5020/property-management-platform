import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { type CreateUserInput, type User } from '../models/user.model';
import {
  registerUser as registerUserService,
  loginUser as loginUserService,
  forgotPassword as forgotPasswordService,
  resetPassword as resetPasswordService,
  changePassword as changePasswordService,
  getUserById as getUserByIdService,
  updateProfile as updateProfileService,
  deleteMe as deleteMeService,
  listUsers as listUsersService,
  updateUserStatus as updateUserStatusService,
} from '../services/user.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

import type {
  LoginUserInput,
  UpdateUserInput,
  ResetPasswordInput,
  ChangePasswordInput,
  SafeUser,
} from '../types/user.types';

const registerUser = asyncHandler(
  async (req: Request<unknown, unknown, CreateUserInput>, res: Response): Promise<void> => {
    const user = await registerUserService(req.body);
    const safe = user as unknown as SafeUser;

    res.status(StatusCodes.CREATED).json(
      createSuccessResponse({
        statusCode: StatusCodes.CREATED,
        message: SUCCESS_MESSAGES.common.success,
        data: safe,
      }),
    );
  },
);

const loginUser = asyncHandler(
  async (req: Request<unknown, unknown, LoginUserInput>, res: Response): Promise<void> => {
    const loginResponse = await loginUserService({ ...req.body, loginIp: req.ip });

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: loginResponse,
      }),
    );
  },
);

const forgotPassword = asyncHandler(
  async (req: Request<unknown, unknown, { email: string }>, res: Response): Promise<void> => {
    await forgotPasswordService(req.body.email);
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: null,
      }),
    );
  },
);

const resetPassword = asyncHandler(
  async (req: Request<unknown, unknown, ResetPasswordInput>, res: Response): Promise<void> => {
    await resetPasswordService(req.body.token, req.body.password);
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: null,
      }),
    );
  },
);

const verifyEmail = (_req: Request<unknown, unknown, { token: string }>, res: Response): void => {
  // Verification logic should be implemented in service; placeholder
  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: null,
    }),
  );
};

const resendVerificationEmail = (
  _req: Request<unknown, unknown, { email: string }>,
  res: Response,
): void => {
  // Implement in service if required
  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: null,
    }),
  );
};

const getMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as unknown as { id?: string }).id;
  if (!userId) {
    res.status(StatusCodes.UNAUTHORIZED).json(
      createSuccessResponse({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Unauthorized',
        data: null,
      }),
    );
    return;
  }

  const user = await getUserByIdService(userId);

  if (!user) {
    res.status(StatusCodes.NOT_FOUND).json(
      createSuccessResponse({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'User not found',
        data: null,
      }),
    );
    return;
  }

  const safe = user as unknown as SafeUser;

  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: safe,
    }),
  );
});

const updateMe = asyncHandler(
  async (req: Request<unknown, unknown, UpdateUserInput>, res: Response): Promise<void> => {
    const userId = (req as unknown as { id?: string }).id;
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json(
        createSuccessResponse({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Unauthorized',
          data: null,
        }),
      );
      return;
    }

    const input = req.body;
    const updated = await updateProfileService(userId, input);
    const safe = updated as unknown as SafeUser;
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safe,
      }),
    );
  },
);

const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as unknown as { id?: string }).id;
  if (!userId) {
    res.status(StatusCodes.UNAUTHORIZED).json(
      createSuccessResponse({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Unauthorized',
        data: null,
      }),
    );
    return;
  }

  const input = req.body as ChangePasswordInput;
  await changePasswordService(userId, input.currentPassword, input.newPassword);
  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: null,
    }),
  );
});

const updateProfileImage = asyncHandler(
  async (req: Request<unknown, unknown, UpdateUserInput>, res: Response): Promise<void> => {
    // If you use file uploads, integrate upload service; here we accept profileImageUrl in body
    const userId = (req as unknown as { id?: string }).id;
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json(
        createSuccessResponse({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Unauthorized',
          data: null,
        }),
      );
      return;
    }

    const input = {
      profileImageUrl:
        (req.body as unknown as { profileImageUrl?: string }).profileImageUrl ?? null,
    };
    const updated = await updateProfileService(userId, input);
    const safe = updated as unknown as SafeUser;
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safe,
      }),
    );
  },
);

const deleteMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = (req as unknown as { id?: string }).id;
  if (!userId) {
    res.status(StatusCodes.UNAUTHORIZED).json(
      createSuccessResponse({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Unauthorized',
        data: null,
      }),
    );
    return;
  }

  const deleted = await deleteMeService(userId);
  const safe = deleted as unknown as SafeUser;
  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: safe,
    }),
  );
});

// Admin controllers
const listUsers = asyncHandler(
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
    const limitNumber = limit ? Number(limit) : 20;
    const offsetNumber = offset ? Number(offset) : 0;
    const { items, total } = await listUsersService({
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

const getUserById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await getUserByIdService(id);

    if (!user) {
      res.status(StatusCodes.NOT_FOUND).json(
        createSuccessResponse({
          statusCode: StatusCodes.NOT_FOUND,
          message: 'User not found',
          data: null,
        }),
      );
      return;
    }

    const safe = user as unknown as SafeUser;

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safe,
      }),
    );
  },
);

const updateUserStatus = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, { status: string }>,
    res: Response,
  ): Promise<void> => {
    const { id } = req.params;
    const updated = await updateUserStatusService(id, req.body.status as User['status']);
    const safe = updated as unknown as SafeUser;
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: safe,
      }),
    );
  },
);

export {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getMe,
  updateMe,
  changePassword,
  updateProfileImage,
  deleteMe,
  // admin
  listUsers,
  getUserById,
  updateUserStatus,
};
