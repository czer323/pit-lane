import { Show, createSignal } from "solid-js";
import { Title } from "@solidjs/meta";
import { authClient } from "~/lib/auth-client";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

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
    <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <Title>Sign in — Pit Lane</Title>
      <Card class="w-full max-w-sm">
        <CardHeader>
          <CardTitle class="text-center text-2xl">Pit Lane</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4 text-center">
          <p class="text-sm text-muted-foreground">Sign in to manage your cars, races, and runs.</p>
          <Button onClick={handleSignIn} class="w-full">
            Sign in with Google
          </Button>
          <Show when={error()}>
            <p class="text-sm text-red-400" role="alert">
              {error()}
            </p>
          </Show>
        </CardContent>
      </Card>
    </div>
  );
}
