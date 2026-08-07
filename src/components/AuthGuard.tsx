import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, type JSX } from "solid-js";
import { authClient } from "~/lib/auth-client";
import { resolveGuardAction } from "~/lib/guard";

/**
 * Client-side route guard. Complements the server middleware: after
 * hydration the better-auth session is fetched in the browser, and
 * signed-out users are redirected to /login (signed-in users away from
 * /login). Covers client-side navigation, which never hits the server.
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
