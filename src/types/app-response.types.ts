interface AppSuccessResponse<T = unknown> {
  status: 'success';
  statusCode: number;
  message: string;
  data?: T;
}

interface AppErrorResponse {
  status: 'error';
  statusCode: number;
  message: string;
  errors?: unknown[];
}

interface ResponseError extends Error {
  statusCode: number;
  errors?: unknown[];
}

export { type AppErrorResponse, type AppSuccessResponse, type ResponseError };
