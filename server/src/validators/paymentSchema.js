import { z } from "zod";

const paymentPayloadSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than zero."),
});

export function normalizePaymentPayload(payload) {
  return paymentPayloadSchema.parse(payload);
}
