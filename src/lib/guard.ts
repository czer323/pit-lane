/**
 * Route guard decision logic shared by the server middleware and the
 * client-side AuthGuard. Kept pure so the auth behavior is unit-testable
 * without a request context.
 */

export type GuardAction = "allow" | "redirect-login" | "redirect-home";

/**
 * Decide what a route should do for a given pathname and session state.
 * App pages require a session; the login page is public but should not be
 * shown to users who are already signed in.
 */
export function resolveGuardAction(pathname: string, hasSession: boolean): GuardAction {
  // Home page is always public
  if (pathname === "/") return "allow";
  if (pathname === "/login") {
    return hasSession ? "redirect-home" : "allow";
  }
  return hasSession ? "allow" : "redirect-login";
}

/**
 * Paths that never require a session: the home page, login page,
 * auth/API routes, and the internal server-function transport.
 * Server functions enforce their own auth per call (UnauthorizedError).
 */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_server")
  );
}
