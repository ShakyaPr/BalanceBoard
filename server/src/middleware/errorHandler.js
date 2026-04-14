import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NotFoundError, RequestValidationError } from "../utils/errors.js";

export function errorHandler(error, _request, response, _next) {
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: "Invalid statement payload.",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof RequestValidationError) {
    return response.status(error.status).json({
      message: error.message,
      errors: error.details,
    });
  }

  if (error instanceof NotFoundError) {
    return response.status(error.status).json({
      message: error.message,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return response.status(400).json({
      message: "Database write failed.",
      code: error.code,
    });
  }

  console.error(error);

  return response.status(500).json({
    message: "Unexpected server error.",
  });
}
