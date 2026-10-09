import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const validate =
  <T extends z.ZodType>(schema: T) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        errors: result.error.issues,
      });
    }

    next();
  };
