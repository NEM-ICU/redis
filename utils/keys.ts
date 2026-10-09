//bites:restaurant:--data--

export function getKeyName(...args: string[]) {
  return `bites:${args.join(":")}`;
}

export const restaurantKeyById = (id: string) => getKeyName("restaurants", id);

export const reviewKeyById = (id: string) => getKeyName("reviews", id);

export const reviewDetailsKeyById = (id: string) =>
  getKeyName("review_details", id);

export const cusinesKey = getKeyName("cuisines");

export const cuisineKey = (name: string) => getKeyName("cusine", name);

export const restaurantCuisinesKeyById = (id: string) =>
  getKeyName("restaurant_cuisines", id);

export const restaurantsByRatingKey = getKeyName("restaurants_by_rating");

export const weatherKeyById = (id: string) => getKeyName("weather", id);

export const restaurantDetailsKeyById = (id: string) =>
  getKeyName("restaurant_details", id);
