import { describe, expect, it, vi } from "vite-plus/test";
import { createMemoryHistory, MemoryRouter, Route, useLocation } from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import AuthGuard from "./AuthGuard";

const m = vi.hoisted(() => ({
  session: {
    data: null as Record<string, unknown> | null,
    isPending: true,
    error: null as Error | null,
    isRefetching: false,
    refetch: () => {},
  },
}));

vi.mock("~/lib/auth-client", () => ({
  authClient: {
    useSession: () => () => m.session,
  },
}));

function PathProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function Home() {
  return <div>home</div>;
}

function Cars() {
  return <div>cars</div>;
}

function LoginPage() {
  return <div>login</div>;
}

function renderAt(path: string) {
  const history = createMemoryHistory();
  history.set({ value: path, replace: true });
  return render(() => (
    <MemoryRouter
      history={history}
      root={(props) => (
        <AuthGuard>
          <PathProbe />
          {props.children}
        </AuthGuard>
      )}
    >
      <Route path="/" component={Home} />
      <Route path="/cars" component={Cars} />
      <Route path="/login" component={LoginPage} />
    </MemoryRouter>
  ));
}

describe("AuthGuard", () => {
  it("redirects signed-out users on app pages to /login", async () => {
    m.session = { ...m.session, data: null, isPending: false };
    renderAt("/cars");
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/login"));
  });

  it("allows signed-in users on app pages", () => {
    m.session = { ...m.session, data: { user: { id: "u1" }, session: {} }, isPending: false };
    renderAt("/cars");
    expect(screen.getByTestId("path")).toHaveTextContent("/cars");
  });

  it("lets signed-out users view /login", () => {
    m.session = { ...m.session, data: null, isPending: false };
    renderAt("/login");
    expect(screen.getByTestId("path")).toHaveTextContent("/login");
  });

  it("redirects signed-in users away from /login to the app", async () => {
    m.session = { ...m.session, data: { user: { id: "u1" }, session: {} }, isPending: false };
    renderAt("/login");
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/"));
  });
});
