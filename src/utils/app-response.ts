import { SUCCESS_MESSAGES } from '../shared/success-messages';
import {
  type AppErrorResponse,
  type AppSuccessResponse,
  type ResponseError,
} from '../types/app-response.types';

interface CreateSuccessResponseInput<T> {
  statusCode: number;
  message: string;
  data?: T;
}

interface CreateErrorResponseInput {
  statusCode: number;
  message: string;
  errors?: unknown[];
}

const createSuccessResponse = <T>({
  statusCode,
  message,
  data,
}: CreateSuccessResponseInput<T>): AppSuccessResponse<T> => {
  return {
    status: SUCCESS_MESSAGES.common.success,
    statusCode,
    message,
    ...(data !== undefined ? { data } : {}),
  };
};

const createErrorResponse = ({
  statusCode,
  message,
  errors,
}: CreateErrorResponseInput): AppErrorResponse => {
  return {
    status: 'error',
    statusCode,
    message,
    ...(errors !== undefined ? { errors } : {}),
  };
};

const createResponseError = ({
  statusCode,
  message,
  errors,
}: CreateErrorResponseInput): ResponseError => {
  const error = new Error(message) as ResponseError;

  error.name = 'ResponseError';
  error.statusCode = statusCode;
  error.errors = errors;

  return error;
};

const isResponseError = (error: unknown): error is ResponseError => {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof error.statusCode === 'number' &&
    (!('errors' in error) || error.errors === undefined || Array.isArray(error.errors))
  );
};

export { createErrorResponse, createResponseError, createSuccessResponse, isResponseError };
