import type { Request, Response, NextFunction } from "express";
import { initializeRedisClient } from "@/utils/client.js";
import { restaurantKeyById } from "@/utils/keys.js";
import { errorResponse } from "@/utils/responses.js";

export const checkRestaurantExists = async (
  req: Request<{ restaurantId: string }>,
  res: Response,
  next: NextFunction,
) => {
  const { restaurantId } = req.params;

  if (!restaurantId) {
    return errorResponse(res, 400, "Restaurant ID not found");
  }
  const client = await initializeRedisClient();
  const restaurantKey = restaurantKeyById(restaurantId);
  const exist = await client.exists(restaurantKey);

  if (!exist) {
    return errorResponse(res, 404, "Not Found");
  }
  next();
};
