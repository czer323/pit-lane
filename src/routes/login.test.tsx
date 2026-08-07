import { describe, expect, it, vi } from "vite-plus/test";
import { MetaProvider } from "@solidjs/meta";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import Login from "./login";
import { authClient } from "~/lib/auth-client";

vi.mock("~/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn<() => Promise<unknown>>() } },
}));

const signInSocial = vi.mocked(authClient.signIn.social);

function renderLogin() {
  return render(() => (
    <MetaProvider>
      <Login />
    </MetaProvider>
  ));
}

describe("Login page", () => {
  it("renders a 'Sign in with Google' button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("starts Google OAuth when the button is clicked", async () => {
    const u = userEvent.setup();
    renderLogin();
    await u.click(screen.getByRole("button", { name: /sign in with google/i }));
    expect(signInSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "/" });
  });
});
