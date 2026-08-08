import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@solidjs/testing-library";
import { MetaProvider } from "@solidjs/meta";

// Controllable pathname for test scenarios
let mockPathname = "/fleet";
const mockNavigate = vi.fn();
const mockSession = vi.fn<() => { isPending: boolean; data: { user: { id: string } } | null }>();

vi.mock("~/lib/auth-client", () => ({
  authClient: {
    useSession: () => mockSession,
  },
}));

vi.mock("@solidjs/router", () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
  A: (props: { href: string; children: unknown }) => (
    <a href={props.href}>{props.children as string}</a>
  ),
}));

import AuthGuard from "./AuthGuard";

const wrapper = (props: { children: unknown }) => (
  <MetaProvider>{props.children as string}</MetaProvider>
);

describe("AuthGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/fleet";
  });

  it("renders children when session is authenticated", () => {
    mockSession.mockReturnValue({
      isPending: false,
      data: { user: { id: "user_1" } },
    });

    render(
      () => (
        <AuthGuard>
          <p>Protected content</p>
        </AuthGuard>
      ),
      { wrapper },
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders children while session is pending (redirect fires on resolve)", () => {
    mockSession.mockReturnValue({ isPending: true, data: null });

    render(
      () => (
        <AuthGuard>
          <p>Pending content</p>
        </AuthGuard>
      ),
      { wrapper },
    );

    expect(screen.getByText("Pending content")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects to /login when session resolves to unauthenticated", () => {
    mockSession.mockReturnValue({ isPending: false, data: null });

    render(
      () => (
        <AuthGuard>
          <p>Protected content</p>
        </AuthGuard>
      ),
      { wrapper },
    );

    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("redirects authenticated user away from /login", () => {
    mockPathname = "/login";
    mockSession.mockReturnValue({
      isPending: false,
      data: { user: { id: "user_1" } },
    });

    render(
      () => (
        <AuthGuard>
          <p>Login page</p>
        </AuthGuard>
      ),
      { wrapper },
    );

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("allows home page without session", () => {
    mockPathname = "/";
    mockSession.mockReturnValue({ isPending: false, data: null });

    render(
      () => (
        <AuthGuard>
          <p>Home content</p>
        </AuthGuard>
      ),
      { wrapper },
    );

    expect(screen.getByText("Home content")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
