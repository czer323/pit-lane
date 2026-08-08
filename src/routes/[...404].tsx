import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { A } from "@solidjs/router";
import { Button } from "~/components/ui/button";

export default function NotFound() {
  return (
    <div class="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <div class="text-center space-y-4">
        <Title>Not Found — Pit Lane</Title>
        <HttpStatusCode code={404} />
        <h1 class="text-4xl font-bold">404</h1>
        <p class="text-muted-foreground">Page not found.</p>
        <A href="/">
          <Button>Back to Dashboard</Button>
        </A>
      </div>
    </div>
  );
}
