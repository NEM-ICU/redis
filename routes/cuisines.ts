import { initializeRedisClient } from "@/utils/client.js";
import { cusinesKey, cuisineKey, restaurantKeyById } from "@/utils/keys.js";
import { successResponse } from "@/utils/responses.js";
import express, { Request } from "express";
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const client = await initializeRedisClient();
    const cusines = await client.sMembers(cusinesKey);
    return successResponse(res, cusines);
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:cuisine",
  async (req: Request<{ cuisine: string }>, res, next) => {
    const { cuisine } = req.params;

    try {
      const client = await initializeRedisClient();
      const restaurantIds = await client.sMembers(cuisineKey(cuisine));
      const restaurants = await Promise.all(
        restaurantIds.map((id) => client.hGet(restaurantKeyById(id), "name")),
      );
      return successResponse(res, restaurants);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
