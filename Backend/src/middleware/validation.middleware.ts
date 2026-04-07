import { Request, Response, NextFunction } from 'express';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ResponseUtil } from '../utils/response.util';

export const validateDto = (dtoClass: any) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const dtoInstance = plainToClass(dtoClass, req.body);
        const errors: ValidationError[] = await validate(dtoInstance);

        if (errors.length > 0) {
            const formattedErrors = errors.map((error) => ({
                property: error.property,
                constraints: error.constraints,
            }));

            ResponseUtil.badRequest(res, 'Validation failed', JSON.stringify(formattedErrors));
            return;
        }

        req.body = dtoInstance;
        next();
    };
};
