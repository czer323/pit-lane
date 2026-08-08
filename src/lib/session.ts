import { getWebRequest } from "@solidjs/start/http";
import { auth } from "./auth";

/**
 * Error thrown when a signed-in user is required but no valid session exists.
 * Carries a 401 status so callers can read `err.status === 401` to distinguish
 * auth failures from server errors.
 *
 * Boundary note: the server-function boundary does not translate this into an
 * HTTP 401; thrown errors cross as 200 + X-Error(message) for both auth
 * failures and server errors. Seroval preserves `status`, `name`, and
 * `message` as own properties on the client-side error, but the subclass
 * prototype (and therefore `instanceof`) is lost.
 */
export class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Get the current session from the incoming request headers.
 * Server-only. Returns null when no valid session (signed out).
 */
export async function getSession() {
  const request = getWebRequest();
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session;
}

/**
 * Get the current signed-in user, or null.
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Get the current signed-in user's ID, or null.
 */
export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}
