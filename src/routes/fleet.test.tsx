import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen, waitFor } from "@solidjs/testing-library";
import { MetaProvider } from "@solidjs/meta";

vi.mock("~/server/api/cars", () => ({
  createCar: vi.fn(),
  listCars: vi.fn(),
  setAtTrack: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  useLocation: () => ({ pathname: "/fleet" }),
  useNavigate: () => vi.fn(),
  A: (props: { href: string; children: unknown }) => (
    <a href={props.href}>{props.children as string}</a>
  ),
}));

import Fleet from "../routes/fleet";

const wrapper = (props: { children: unknown }) => (
  <MetaProvider>{props.children as string}</MetaProvider>
);

describe("Fleet page", () => {
  it("renders Fleet Manager heading", () => {
    const { container } = render(() => <Fleet />, { wrapper });
    expect(screen.getByText("Fleet Manager")).toBeInTheDocument();
  });

  it("renders Add a Car section", () => {
    render(() => <Fleet />, { wrapper });
    expect(screen.getByText("Add a Car")).toBeInTheDocument();
  });

  it("renders Your Cars section", () => {
    render(() => <Fleet />, { wrapper });
    expect(screen.getByText("Your Cars")).toBeInTheDocument();
  });

  it("renders AddCarForm and CarList", () => {
    render(() => <Fleet />, { wrapper });
    expect(screen.getByLabelText("Car Name")).toBeInTheDocument();
  });
});
