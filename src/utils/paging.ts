import { StatusCodes } from 'http-status-codes';

import { createResponseError } from './app-response';

const MAX_LIMIT = 200;

// Reads ?limit / ?offset safely: missing → defaults; anything that isn't a whole number in range is
// a 422 instead of reaching SQL (where it used to fail as a 500).
export const parsePaging = (
  limit: unknown,
  offset: unknown,
  defaultLimit = 20,
): { limit: number; offset: number } => {
  const l = limit === undefined || limit === '' ? defaultLimit : Number(limit);
  const o = offset === undefined || offset === '' ? 0 : Number(offset);
  if (!Number.isInteger(l) || l < 1 || l > MAX_LIMIT || !Number.isInteger(o) || o < 0) {
    throw createResponseError({
      statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
      message: `limit must be a whole number from 1 to ${MAX_LIMIT}, and offset 0 or more`,
    });
  }
  return { limit: l, offset: o };
};
