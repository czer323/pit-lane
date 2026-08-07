import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Show, Suspense } from "solid-js";
import AuthGuard from "./components/AuthGuard";
import SignOutButton from "./components/SignOutButton";
import { authClient } from "./lib/auth-client";
import "./app.css";

function AppHeader() {
  const session = authClient.useSession();
  return (
    <header>
      <nav>
        <a href="/">Index</a>
        <a href="/about">About</a>
        <Show when={session().data}>
          <SignOutButton />
        </Show>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>SolidStart - Basic</Title>
          <AuthGuard>
            <AppHeader />
            <Suspense>{props.children}</Suspense>
          </AuthGuard>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
