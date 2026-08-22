export class EventWriteError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "EventWriteError";
    this.status = status;
  }
}

export function isEventWriteError(error: unknown): error is EventWriteError {
  return error instanceof EventWriteError;
}
