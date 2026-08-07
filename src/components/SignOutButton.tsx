import { useNavigate } from "@solidjs/router";
import { authClient } from "~/lib/auth-client";

/**
 * Minimal sign-out control for the app header. Clears the session via
 * better-auth then navigates to the login page.
 */
export default function SignOutButton() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <button type="button" class="sign-out" onClick={handleSignOut}>
      Sign out
    </button>
  );
}
