import { validate } from "@/middleware/validate.js";
import { NextFunction, Request } from "express";
import { Restaurant, RestaurantSchema } from "@/schemas/restaurants.js";
import { initializeRedisClient } from "@/utils/client.js";
import {
  cuisineKey,
  cusinesKey,
  restaurantCuisinesKeyById,
  restaurantKeyById,
  restaurantsByRatingKey,
  reviewDetailsKeyById,
  reviewKeyById,
  weatherKeyById,
} from "@/utils/keys.js";
import { errorResponse, successResponse } from "@/utils/responses.js";
import express from "express";
import { nanoid } from "nanoid";
import { checkRestaurantExists } from "@/middleware/checkRestaurantId.js";
import { Review, ReviewSchema } from "@/schemas/review.js";
const router = express.Router();

router.get("/", async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const start = Number(page) - 1 * Number(limit);
  const end = start + Number(limit);

  try {
    const client = await initializeRedisClient();
    const restaurantIds = await client.zRange(
      restaurantsByRatingKey,
      start,
      end,
      {
        REV: true,
      },
    );

    const restaurants = await Promise.all(
      restaurantIds.map((id) => client.hGetAll(restaurantKeyById(id))),
    );
    return successResponse(res, restaurants);
  } catch (err) {
    next(err);
  }
});

router.post("/", validate(RestaurantSchema), async (req, res, next) => {
  const data = req.body as Restaurant;

  try {
    const client = await initializeRedisClient();

    const id = nanoid();
    const restaurantKey = restaurantKeyById(id);
    const hashData = { id, name: data.name, location: data.location };

    await Promise.all([
      //["pasta", "cake"]
      ...data.cuisines.map((cusine) =>
        Promise.all([
          client.sAdd(cusinesKey, cusine), // Get all the cusines and its in a set
          client.sAdd(cuisineKey(cusine), id),
          client.sAdd(restaurantCuisinesKeyById(id), cusine), // restaurant-cusine${restaurantId}__name (get cusine)
        ]),
      ),
      client.hSet(restaurantKey, hashData),
      client.zAdd(restaurantsByRatingKey, {
        score: 0,
        value: id,
      }),
    ]);

    return successResponse(res, hashData);
  } catch (err) {
    next(err);
  }
});

router.get(
  "/:restaurantId/weather",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;

    try {
      const client = await initializeRedisClient();
      const weatherKey = weatherKeyById(restaurantId);

      const cachedWeather = await client.get(weatherKey);

      if (cachedWeather) {
        return successResponse(res, JSON.parse(cachedWeather));
      }

      const restaurantKey = restaurantKeyById(restaurantId);

      const coords = await client.hGet(restaurantKey, "location");
      if (!coords) {
        return errorResponse(res, 404, "Coordinates have not been found!");
      }
      const [lat, lng] = coords.split(",");
      const apiResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.WEATHER_API_KEY}&units=metric`,
      );

      if (apiResponse.status === 200) {
        const json = await apiResponse.json();
        await client.set(weatherKey, JSON.stringify(json), {
          EX: 60 * 60,
        });
        return successResponse(res, json);
      }
      return errorResponse(res, 500, "Couldnt fetch weather info!");
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:restaurantId",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    try {
      const client = await initializeRedisClient();
      const restaurantKey = restaurantKeyById(restaurantId);

      const [viewCount, restaurant, cuisines] = await Promise.all([
        client.hIncrBy(restaurantKey, "viewCount", 1),
        client.hGetAll(restaurantKey),
        client.sMembers(restaurantCuisinesKeyById(restaurantId)),
      ]);
      return successResponse(res, { ...restaurant, cuisines });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/:restaurantId/reviews",
  checkRestaurantExists,
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const start = (Number(page) - 1) * Number(limit);
    const end = start + Number(limit);

    try {
      const client = await initializeRedisClient();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewIds = await client.lRange(reviewKey, start, end);

      const reviews = await Promise.all(
        reviewIds.map((id) => client.hGetAll(reviewDetailsKeyById(id))),
      );

      return successResponse(res, reviews);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/:restaurantId/reviews",
  checkRestaurantExists,
  validate(ReviewSchema),
  async (req: Request<{ restaurantId: string }>, res, next) => {
    const { restaurantId } = req.params;
    const data = req.body as Review;

    try {
      const client = await initializeRedisClient();
      const reviewId = nanoid();
      const reviewKey = reviewKeyById(restaurantId);

      const reviewDetailsKey = reviewDetailsKeyById(reviewId);
      const restaurantKey = restaurantKeyById(restaurantId);

      const reviewData = {
        id: reviewId,
        ...data,
        timestamp: Date.now(),
        restaurantId,
      };

      const [reviewCount, setResult, totalStars] = await Promise.all([
        client.lPush(reviewKey, reviewId),
        client.hSet(reviewDetailsKey, reviewData),
        client.hIncrByFloat(restaurantKey, "totalStars", data.rating),
      ]);

      const averageRating = Number(
        (Number(totalStars) / reviewCount).toFixed(1),
      );

      await Promise.all([
        client.zAdd(restaurantsByRatingKey, {
          score: averageRating,
          value: restaurantId,
        }),
        client.hSet(restaurantKey, "avgStars", averageRating),
      ]);

      return successResponse(res, reviewData, "Review Added!");
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:restaurantId/reviews/:reviewId",
  checkRestaurantExists,
  async (
    req: Request<{ restaurantId: string; reviewId: string }>,
    res,
    next,
  ) => {
    const { restaurantId, reviewId } = req.params;

    try {
      const client = await initializeRedisClient();
      const reviewKey = reviewKeyById(restaurantId);
      const reviewDetailsKey = reviewDetailsKeyById(reviewId);

      const [removeResult, deleteResult] = await Promise.all([
        client.lRem(reviewKey, 0, reviewId),
        client.del(reviewDetailsKey),
      ]);

      if (removeResult === 0 && deleteResult == 0) {
        return errorResponse(res, 404, "Review not found!");
      }
      return successResponse(res, reviewId, "Review deleted!");
    } catch (err) {
      next(err);
    }
  },
);

export default router;
