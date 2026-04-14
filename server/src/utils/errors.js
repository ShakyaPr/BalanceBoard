export class RequestValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "RequestValidationError";
    this.status = 400;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
    this.details = [];
  }
}

