import { describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@solidjs/testing-library";
import { MetaProvider } from "@solidjs/meta";

// Mock @solidjs/router A component to avoid router context requirement
vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: any }) => <a href={props.href}>{props.children}</a>,
  useNavigate: () => () => {},
}));

vi.mock("~/server/api/cars", () => ({
  listCars: vi.fn<() => Promise<any[]>>(async () => [
    {
      carId: 1,
      name: "Lightning",
      body: "S10",
      bodyType: "lexan",
      chassis: "wire",
      weightG: 85,
      motor: "FK-180SH",
      ampDraw3v: 0.48,
      pinion: 9,
      crown: 27,
      gearRatio: 3.0,
      tireDiaMm: 22.5,
      rollout: 23.56,
      atTrack: false,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    },
    {
      carId: 2,
      name: "Thunder",
      body: "VW Beetle",
      bodyType: "hardbody",
      chassis: "carbon fiber",
      weightG: 92,
      motor: "PS-4000X",
      ampDraw3v: null,
      pinion: 8,
      crown: 28,
      gearRatio: 3.5,
      tireDiaMm: 21.0,
      rollout: 18.85,
      atTrack: true,
      createdAt: "2026-02-01",
      updatedAt: "2026-02-01",
    },
  ]),
}));

import CarList from "./index";

const wrapper = (props: { children: any }) => <MetaProvider>{props.children}</MetaProvider>;

describe("CarList", () => {
  it("renders car cards with names", async () => {
    render(() => <CarList />, { wrapper });
    const lightning = await screen.findByText("Lightning");
    expect(lightning).toBeInTheDocument();
    const thunder = await screen.findByText("Thunder");
    expect(thunder).toBeInTheDocument();
  });

  it("renders car specs on each card", async () => {
    render(() => <CarList />, { wrapper });
    // Wait for data to load
    await screen.findByText("Lightning");
    // Specs are visible as text content
    const fkElement = screen.getByText("FK-180SH");
    expect(fkElement).toBeInTheDocument();
    const s10Element = screen.getByText("S10");
    expect(s10Element).toBeInTheDocument();
  });

  it("shows at-track badge for at-track cars", async () => {
    render(() => <CarList />, { wrapper });
    expect(await screen.findByText(/at track/i)).toBeInTheDocument();
  });

  it("shows + Add Car button", async () => {
    render(() => <CarList />, { wrapper });
    expect(await screen.findByRole("link", { name: /add car/i })).toBeInTheDocument();
  });
});
