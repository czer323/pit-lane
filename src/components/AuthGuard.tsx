import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, type JSX } from "solid-js";
import { authClient } from "~/lib/auth-client";
import { resolveGuardAction } from "~/lib/guard";

/**
 * Client-side route guard. The server middleware (src/middleware/index.ts)
 * handles initial requests — this only runs on client-side navigations
 * (e.g. expired session after hours of idle, or direct SPA route changes).
 *
 * Children render unconditionally; redirect fires as an effect only when
 * the session resolves and the user lacks access. A brief flash is
 * acceptable here because the server middleware prevents unauthenticated
 * SSR of protected pages.
 */
export default function AuthGuard(props: { children: JSX.Element }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = authClient.useSession();

  createEffect(() => {
    const current = session();
    if (current.isPending) return;
    const action = resolveGuardAction(location.pathname, Boolean(current.data));
    if (action === "redirect-login") {
      navigate("/login", { replace: true });
    } else if (action === "redirect-home") {
      navigate("/", { replace: true });
    }
  });

  return <>{props.children}</>;
}
