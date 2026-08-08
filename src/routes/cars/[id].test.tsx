import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import { render, screen } from "@solidjs/testing-library";
import { MetaProvider } from "@solidjs/meta";
import { getCar, deleteCar } from "~/server/api/cars";

vi.mock("~/server/api/cars", () => ({
  getCar: vi.fn<typeof getCar>(),
  deleteCar: vi.fn<() => Promise<void>>(),
}));

vi.mock("@solidjs/router", () => ({
  A: (props: { href: string; children: any }) => <a href={props.href}>{props.children}</a>,
  useNavigate: () => () => {},
}));

const mockedGetCar = vi.mocked(getCar);

import CarDetail from "./[id]";

const wrapper = (props: { children: any }) => <MetaProvider>{props.children}</MetaProvider>;

const mockCar = {
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
  fStop: null,
  rollout: 23.56,
  atTrack: false,
  userId: "user-1",
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  snapshots: [],
};

describe("CarDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders car name when found", async () => {
    mockedGetCar.mockResolvedValue(mockCar as any);
    render(() => <CarDetail params={{ id: "1" }} />, { wrapper });
    expect(await screen.findByText("Lightning")).toBeInTheDocument();
  });

  it("renders car specs", async () => {
    mockedGetCar.mockResolvedValue(mockCar as any);
    render(() => <CarDetail params={{ id: "1" }} />, { wrapper });
    await screen.findByText("Lightning");
    expect(screen.getByText("S10")).toBeInTheDocument();
    expect(screen.getByText("FK-180SH")).toBeInTheDocument();
    expect(screen.getByText("85 g")).toBeInTheDocument();
  });

  it("shows edit and delete buttons", async () => {
    mockedGetCar.mockResolvedValue(mockCar as any);
    render(() => <CarDetail params={{ id: "1" }} />, { wrapper });
    await screen.findByText("Lightning");
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("shows back link to cars list", async () => {
    mockedGetCar.mockResolvedValue(mockCar as any);
    render(() => <CarDetail params={{ id: "1" }} />, { wrapper });
    await screen.findByText("Lightning");
    expect(screen.getByText(/back to cars/i)).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockedGetCar.mockReturnValue(new Promise(() => {})); // never resolves
    render(() => <CarDetail params={{ id: "1" }} />, { wrapper });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
