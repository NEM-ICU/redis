import express from "express";
import restaurantRouter from "./routes/restaurants.js";
import cuisineRouter from "./routes/cuisines.js";
import { errorHandler } from "./middleware/errorHandler.js";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use("/restaurants", restaurantRouter);
app.use("/cuisines", cuisineRouter);

app.use(errorHandler);

app
  .listen(PORT, () => {
    console.log(`Application running on port ${PORT}`);
  })
  .on("error", (err) => {
    throw new Error(err.message);
  });
