import { describe, expect, it, vi } from "vite-plus/test";
import { MemoryRouter, Route, useLocation } from "@solidjs/router";
import { render, screen, waitFor } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import SignOutButton from "./SignOutButton";
import { authClient } from "~/lib/auth-client";

vi.mock("~/lib/auth-client", () => ({
  authClient: {
    signOut: vi.fn<() => Promise<unknown>>().mockResolvedValue({ data: { success: true } }),
  },
}));

function PathProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function renderWithRoutes() {
  return render(() => (
    <MemoryRouter
      root={(props) => (
        <>
          <PathProbe />
          {props.children}
        </>
      )}
    >
      <Route path="/" component={SignOutButton} />
      <Route path="/login" component={() => <div>login</div>} />
    </MemoryRouter>
  ));
}

describe("SignOutButton", () => {
  it("renders a sign out button", () => {
    renderWithRoutes();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("signs out and redirects to /login on click", async () => {
    const u = userEvent.setup();
    renderWithRoutes();
    await u.click(screen.getByRole("button", { name: /sign out/i }));
    expect(authClient.signOut).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/login"));
  });
});
