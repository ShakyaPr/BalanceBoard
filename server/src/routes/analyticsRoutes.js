import { Router } from "express";
import { getAnalyticsSnapshot } from "../services/cardService.js";

const router = Router();

router.get("/", async (_request, response, next) => {
  try {
    const snapshot = await getAnalyticsSnapshot();
    response.json(snapshot);
  } catch (error) {
    next(error);
  }
});

export default router;
