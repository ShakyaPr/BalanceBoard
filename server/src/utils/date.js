import { RequestValidationError } from "./errors.js";

const STATEMENT_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{2}$/;
const TRANSACTION_DATE_PATTERN = /^\d{2}\/\d{2}$/;
const DATE_ORDER = {
  MONTH_DAY: "month-day",
  DAY_MONTH: "day-month",
};

function createValidatedUtcDate(year, month, day, fieldName) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RequestValidationError(`${fieldName} must be a real calendar date.`);
  }

  return date;
}

export function parseShortYearDate(value, fieldName, dateOrder = DATE_ORDER.MONTH_DAY) {
  if (!STATEMENT_DATE_PATTERN.test(value)) {
    throw new RequestValidationError(`${fieldName} must match MM/DD/YY or DD/MM/YY.`);
  }

  const [first, second, year] = value.split("/").map(Number);
  const [month, day] =
    dateOrder === DATE_ORDER.DAY_MONTH ? [second, first] : [first, second];

  return createValidatedUtcDate(2000 + year, month, day, fieldName);
}

export function parseMonthDay(value, fieldName, dateOrder = DATE_ORDER.MONTH_DAY) {
  if (!TRANSACTION_DATE_PATTERN.test(value)) {
    throw new RequestValidationError(`${fieldName} must match MM/DD or DD/MM.`);
  }

  const [first, second] = value.split("/").map(Number);
  const [month, day] =
    dateOrder === DATE_ORDER.DAY_MONTH ? [second, first] : [first, second];

  createValidatedUtcDate(2000, month, day, fieldName);

  return {
    label: value,
    month,
    day,
  };
}

export function toIsoDate(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function inferDateOrderFromParts(first, second) {
  if (first > 12 && second <= 12) {
    return DATE_ORDER.DAY_MONTH;
  }

  if (second > 12 && first <= 12) {
    return DATE_ORDER.MONTH_DAY;
  }

  return null;
}

export function detectDateOrder(values) {
  let detectedOrder = null;

  for (const value of values) {
    const [first, second] = value.split("/").map(Number);
    const inferredOrder = inferDateOrderFromParts(first, second);

    if (!inferredOrder) {
      continue;
    }

    // If the payload contains any unambiguous dates, require the whole request to follow that order.
    if (detectedOrder && detectedOrder !== inferredOrder) {
      throw new RequestValidationError(
        "Payload mixes MM/DD and DD/MM date formats. Use one date format consistently within a statement.",
      );
    }

    detectedOrder = inferredOrder;
  }

  return detectedOrder ?? DATE_ORDER.MONTH_DAY;
}
