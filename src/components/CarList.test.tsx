import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createSignal } from "solid-js";
import { render, screen } from "@solidjs/testing-library";
import { MetaProvider } from "@solidjs/meta";
import { listCars } from "~/server/api/cars";

vi.mock("~/server/api/cars", () => ({
  listCars: vi.fn<typeof listCars>(),
}));

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: unknown }) => (
    <a href={props.href}>{props.children as string}</a>
  ),
}));

import CarList from "./CarList";

const mockedListCars = vi.mocked(listCars);

const wrapper = (props: { children: unknown }) => (
  <MetaProvider>{props.children as string}</MetaProvider>
);

// Create a stable signal that tests can share
const [refreshKey] = createSignal(0);

describe("CarList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no cars", async () => {
    mockedListCars.mockResolvedValue([]);
    render(() => <CarList refreshKey={refreshKey} />, { wrapper });
    expect(await screen.findByText(/no cars yet/i)).toBeInTheDocument();
  });

  it("renders car names when cars exist", async () => {
    mockedListCars.mockResolvedValue([
      {
        carId: 1,
        name: "Lightning",
        body: "S10",
        motor: "FK-180SH",
        weightG: 85,
        atTrack: false,
        chassis: "wire",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
      {
        carId: 2,
        name: "Thunder",
        body: null,
        motor: null,
        weightG: null,
        atTrack: true,
        chassis: null,
        createdAt: "2026-02-01",
        updatedAt: "2026-02-01",
      },
    ] as Awaited<ReturnType<typeof listCars>>);
    render(() => <CarList refreshKey={refreshKey} />, { wrapper });
    expect(await screen.findByText("Lightning")).toBeInTheDocument();
    expect(screen.getByText("Thunder")).toBeInTheDocument();
  });

  it("shows at-track badge for cars at track", async () => {
    mockedListCars.mockResolvedValue([
      {
        carId: 1,
        name: "Lightning",
        body: "S10",
        motor: "FK-180SH",
        weightG: 85,
        atTrack: true,
        chassis: "wire",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ] as Awaited<ReturnType<typeof listCars>>);
    render(() => <CarList refreshKey={refreshKey} />, { wrapper });
    expect(await screen.findByText(/at track/i)).toBeInTheDocument();
  });
});
