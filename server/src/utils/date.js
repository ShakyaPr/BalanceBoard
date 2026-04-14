import { RequestValidationError } from "./errors.js";

const STATEMENT_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{2}$/;
const TRANSACTION_DATE_PATTERN = /^\d{2}\/\d{2}$/;

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

export function parseShortYearDate(value, fieldName) {
  if (!STATEMENT_DATE_PATTERN.test(value)) {
    throw new RequestValidationError(`${fieldName} must match MM/DD/YY.`);
  }

  const [month, day, year] = value.split("/").map(Number);

  return createValidatedUtcDate(2000 + year, month, day, fieldName);
}

export function parseMonthDay(value, fieldName) {
  if (!TRANSACTION_DATE_PATTERN.test(value)) {
    throw new RequestValidationError(`${fieldName} must match MM/DD.`);
  }

  const [month, day] = value.split("/").map(Number);

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

