import { Router } from "express";
import { getCardDetails } from "../services/cardService.js";

const router = Router();

router.get("/:cardId", async (request, response, next) => {
  try {
    const card = await getCardDetails(request.params.cardId);
    response.json(card);
  } catch (error) {
    next(error);
  }
});

export default router;
