import { createMiddleware } from "@solidjs/start/middleware";
import { isPublicPath, resolveGuardAction } from "~/lib/guard";
import { getSession } from "~/lib/session";

/**
 * Server-side route guard. Runs on every request before the SolidStart
 * handler: redirects signed-out users away from app pages to /login.
 * Public paths (login page, /api/*, and the /_server server-function
 * transport) pass through; server functions enforce their own auth.
 */
export default createMiddleware([
  async (event, next) => {
    const pathname = new URL(event.path, "http://localhost").pathname;

    if (isPublicPath(pathname)) {
      return next();
    }

    const session = await getSession();
    const action = resolveGuardAction(pathname, Boolean(session));
    if (action === "redirect-login") {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }
    return next();
  },
]);
