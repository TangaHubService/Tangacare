import { Request, Response, NextFunction } from 'express';
import { ResponseUtil } from '../utils/response.util';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (err: Error | AppError, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
        ResponseUtil.error(res, err.message, err.statusCode);
        return;
    }

    if (err.name === 'QueryFailedError') {
        ResponseUtil.badRequest(res, 'Database query failed', err.message);
        return;
    }

    if (err.name === 'ValidationError') {
        ResponseUtil.badRequest(res, 'Validation failed', err.message);
        return;
    }

    console.error('Unexpected error:', err);

    const message = process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message;

    ResponseUtil.internalError(res, message, err.stack);
};

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
    ResponseUtil.notFound(res, `Route ${req.originalUrl} not found`);
};
