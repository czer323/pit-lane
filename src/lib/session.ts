import { getWebRequest } from "@solidjs/start/http";
import { auth } from "./auth";

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
