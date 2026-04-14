import { z } from "zod";
import { detectDateOrder, parseMonthDay, parseShortYearDate } from "../utils/date.js";

const transactionSchema = z.object({
  date: z.string().regex(/^\d{2}\/\d{2}$/, "Transaction date must use MM/DD or DD/MM."),
  description: z.string().trim().min(1, "Transaction description is required."),
  amount: z.number().finite(),
  type: z.enum(["debit", "credit"]),
});

const statementPayloadSchema = z
  .object({
    name: z.string().trim().min(1, "Card name is required."),
    date: z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/, "Statement date must use MM/DD/YY or DD/MM/YY."),
    minimum_amount: z.number().nonnegative().optional(),
    total_payable: z.number().nonnegative().optional(),
    monthly_amount: z.number().nonnegative(),
    due_date: z.string().regex(/^\d{2}\/\d{2}\/\d{2}$/, "Due date must use MM/DD/YY or DD/MM/YY."),
    transactions: z.array(transactionSchema),
  })
  .superRefine((value, context) => {
    if (value.minimum_amount === undefined && value.total_payable === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either minimum_amount or total_payable.",
        path: ["minimum_amount"],
      });
    }
  });

export function normalizeStatementPayload(payload) {
  const parsed = statementPayloadSchema.parse(payload);
  const dateOrder = detectDateOrder([
    parsed.date,
    parsed.due_date,
    ...parsed.transactions.map((transaction) => transaction.date),
  ]);

  return {
    cardName: parsed.name.trim(),
    rawStatementDate: parsed.date,
    statementDate: parseShortYearDate(parsed.date, "date", dateOrder),
    rawDueDate: parsed.due_date,
    dueDate: parseShortYearDate(parsed.due_date, "due_date", dateOrder),
    totalPayable: parsed.minimum_amount ?? parsed.total_payable,
    amountDue: parsed.monthly_amount,
    transactions: parsed.transactions.map((transaction, index) => {
      const parsedDate = parseMonthDay(
        transaction.date,
        `transactions[${index}].date`,
        dateOrder,
      );

      return {
        postedOnLabel: parsedDate.label,
        postedOnMonth: parsedDate.month,
        postedOnDay: parsedDate.day,
        description: transaction.description.trim(),
        amount:
          transaction.type === "credit"
            ? -Math.abs(transaction.amount)
            : Math.abs(transaction.amount),
        type: transaction.type,
        position: index,
      };
    }),
  };
}
