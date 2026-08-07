import { Show, createSignal } from "solid-js";
import { Title } from "@solidjs/meta";
import { authClient } from "~/lib/auth-client";

export default function Login() {
  const [error, setError] = createSignal<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    } catch {
      setError("Sign in failed. Google OAuth may not be configured yet.");
    }
  };

  return (
    <main class="login">
      <Title>Sign in — Pit Lane</Title>
      <h1>Pit Lane</h1>
      <p>Sign in to manage your cars, races, and runs.</p>
      <button type="button" class="btn-google" onClick={handleSignIn}>
        Sign in with Google
      </button>
      <Show when={error()}>
        <p class="login-error" role="alert">
          {error()}
        </p>
      </Show>
    </main>
  );
}
