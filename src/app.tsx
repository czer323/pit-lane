import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import AuthGuard from "./components/AuthGuard";
import NavShell from "./components/NavShell";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>Pit Lane</Title>
          <AuthGuard>
            <NavShell>
              <Suspense>{props.children}</Suspense>
            </NavShell>
          </AuthGuard>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
