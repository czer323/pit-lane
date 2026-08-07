import { createAuthClient } from "better-auth/solid";

/**
 * Client-side better-auth client. Imported only from client-reachable code
 * (login page, auth guard, header). The baseURL is derived from
 * window.location at runtime; the server config in ~/lib/auth stays separate.
 */
export const authClient = createAuthClient();
