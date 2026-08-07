import { getWebRequest } from "@solidjs/start/http";
import { auth } from "./auth";

/**
 * Error thrown when a signed-in user is required but no valid session exists.
 * Carries a 401 status so callers can distinguish auth failures from server
 * errors (which are 500).
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
