import { Router } from "express";
import { recordStatementPayment, upsertStatement } from "../services/cardService.js";
import { normalizePaymentPayload } from "../validators/paymentSchema.js";
import { normalizeStatementPayload } from "../validators/statementSchema.js";

const router = Router();

router.post("/", async (request, response, next) => {
  try {
    const normalizedStatement = normalizeStatementPayload(request.body);
    const savedStatement = await upsertStatement(normalizedStatement);

    response.status(201).json({
      message: "Statement saved successfully.",
      statement: savedStatement,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:statementId/payments", async (request, response, next) => {
  try {
    const { amount } = normalizePaymentPayload(request.body);
    const statement = await recordStatementPayment(request.params.statementId, amount);

    response.status(201).json({
      message: "Payment recorded successfully.",
      statement,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
