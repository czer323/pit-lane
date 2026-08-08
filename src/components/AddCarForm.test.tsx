import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render, screen } from "@solidjs/testing-library";
import userEvent from "@testing-library/user-event";
import { createCar } from "~/server/api/cars";

vi.mock("~/server/api/cars", () => ({
  createCar: vi.fn<typeof createCar>(),
  setAtTrack: vi.fn<() => Promise<void>>(),
}));

vi.mock("@solidjs/router", () => ({
  useNavigate: (): (() => void) => vi.fn<() => void>(),
}));

import AddCarForm from "./AddCarForm";

const mockedCreateCar = vi.mocked(createCar);

function mockCarReturn() {
  return {
    carId: 1,
    name: "Lightning",
    body: "S10",
    bodyType: null,
    chassis: "wire",
    weightG: 85,
    motor: "FK-180SH",
    ampDraw3v: null,
    pinion: null,
    crown: null,
    gearRatio: null,
    tireDiaMm: null,
    rollout: null,
    atTrack: false,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    userId: "user_1",
  };
}

const setup = () => render(() => <AddCarForm />);

describe("AddCarForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateCar.mockResolvedValue(mockCarReturn());
  });

  it("renders all form inputs", () => {
    setup();
    expect(screen.getByLabelText("Car Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Body")).toBeInTheDocument();
    expect(screen.getByLabelText("Motor")).toBeInTheDocument();
    expect(screen.getByLabelText("Weight (g)")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    setup();
    expect(screen.getByRole("button", { name: /add car/i })).toBeInTheDocument();
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("shows validation error when name is whitespace", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Car Name"), "   ");
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
  });

  it("calls createCar with form data on valid submit", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Car Name"), "Lightning");
    await user.type(screen.getByLabelText("Body"), "S10");
    await user.type(screen.getByLabelText("Motor"), "FK-180SH");
    await user.type(screen.getByLabelText("Weight (g)"), "85");
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(mockedCreateCar).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Lightning",
        body: "S10",
        motor: "FK-180SH",
        weightG: 85,
      }),
    );
  });

  it("shows success message after creation", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Car Name"), "Lightning");
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/lightning added/i)).toBeInTheDocument();
  });

  it("clears form after successful submission", async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Car Name"), "Lightning");
    await user.type(screen.getByLabelText("Body"), "S10");
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/lightning added/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Car Name")).toHaveValue("");
    expect(screen.getByLabelText("Body")).toHaveValue("");
  });

  it("shows server error on failure", async () => {
    mockedCreateCar.mockRejectedValueOnce(new Error("Server down"));
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText("Car Name"), "Lightning");
    await user.click(screen.getByRole("button", { name: /add car/i }));
    expect(await screen.findByText(/server down/i)).toBeInTheDocument();
  });
});
