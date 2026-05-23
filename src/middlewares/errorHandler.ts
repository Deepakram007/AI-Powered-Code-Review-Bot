import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Express error-handling middleware to intercept all unhandled controller exceptions.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[Error] Unhandled request error on ${req.method} ${req.url}:`, {
    message,
    statusCode,
    stack: env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  return res.status(statusCode).json({
    error: {
      message,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
}
