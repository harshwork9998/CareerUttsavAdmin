export class AdminUserError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AdminUserError";
    this.status = status;
  }
}

export function isAdminUserError(error: unknown): error is AdminUserError {
  return error instanceof AdminUserError;
}
