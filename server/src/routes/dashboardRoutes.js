import { Router } from "express";
import { getDashboardSnapshot } from "../services/cardService.js";

const router = Router();

router.get("/", async (_request, response, next) => {
  try {
    const snapshot = await getDashboardSnapshot();
    response.json(snapshot);
  } catch (error) {
    next(error);
  }
});

export default router;

