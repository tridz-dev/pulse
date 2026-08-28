/**
 * Extracts a human-readable message from an error thrown by this app's API layer.
 *
 * The frappe-js-sdk (see `frappe-sdk.ts`) does not reject with a real `Error`
 * instance. Its `call`/`db` methods reject with a plain object shaped like:
 *   { httpStatus, httpStatusText, message, exception, exc?, exc_type?, _server_messages? }
 * (see node_modules/frappe-js-sdk/lib/frappe_app/types.d.ts, interface Error).
 *
 * `message` carries the server's actual error text when available (e.g.
 * "Employee 'X' is outside your scope."), falling back to a generic
 * "There was an error." string set by the SDK itself. `exception` carries the
 * fully-qualified exception string (e.g. "frappe.exceptions.PermissionError: ...")
 * and is used as a secondary source when `message` isn't a usable string.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; exception?: unknown };

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }

    if (typeof candidate.exception === 'string' && candidate.exception.trim()) {
      return candidate.exception;
    }
  }

  return fallback;
}
